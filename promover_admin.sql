-- Atualizar usuário para ADMIN
-- Troque 'admin@refrigeracaojk.com' pelo email que você usou no cadastro
update public.profiles
set role = 'admin'
where email = 'jhonkleymatos@gmail.com';

-- Se, por acaso, você já tinha o usuário criado ANTES de rodar o script de profiles,
-- ele pode não ter um perfil ainda. Nesse caso, insira manualmente:
insert into public.profiles (id, email, role, nome)
select id, email, 'admin', 'Técnico Responsável'
from auth.users
where email = 'jhonkleymatos@gmail.com'
on conflict (id) do update
set role = 'admin';
