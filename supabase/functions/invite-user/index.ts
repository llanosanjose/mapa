import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    // Client con service_role para operaciones admin
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verificar que el que llama es un presidente
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Sin autorización' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { data: perfil } = await adminClient
      .from('perfiles')
      .select('rol')
      .eq('id', caller.id)
      .single();

    if (perfil?.rol !== 'presidente') {
      return new Response(JSON.stringify({ error: 'Solo el presidente puede invitar usuarios' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Leer parámetros
    const { email, rol } = await req.json();
    if (!email || !rol) {
      return new Response(JSON.stringify({ error: 'Faltan email o rol' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const ROLES_VALIDOS = ['presidente', 'administrativo', 'vocal'];
    if (!ROLES_VALIDOS.includes(rol)) {
      return new Response(JSON.stringify({ error: 'Rol no válido' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Enviar invitación — si el usuario ya existe, reenviar enlace de acceso
    let userId: string;
    const { data: invited, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email);

    if (inviteErr) {
      // Si ya existe, buscar su ID y reenviar un magic link
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existing = existingUsers?.users?.find(u => u.email === email);
      if (!existing) {
        return new Response(JSON.stringify({ error: inviteErr.message }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      userId = existing.id;
      // Generar nuevo enlace de invitación para el usuario existente
      await adminClient.auth.admin.generateLink({ type: 'magiclink', email });
    } else {
      userId = invited.user.id;
    }

    // Insertar/actualizar en perfiles con el rol elegido
    const { error: perfilErr } = await adminClient
      .from('perfiles')
      .upsert({ id: userId, rol, email }, { onConflict: 'id' });

    if (perfilErr) {
      return new Response(JSON.stringify({ error: 'Usuario invitado pero error asignando rol: ' + perfilErr.message }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, email }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
