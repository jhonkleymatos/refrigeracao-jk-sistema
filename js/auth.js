// Gerenciamento de Autenticação e Roteamento

const authState = {
    user: null,
    profile: null
};

// Elementos da UI
const loginForm = document.getElementById('login-form');
const authSection = document.getElementById('auth-section');
const adminSection = document.getElementById('admin-section');
const clientSection = document.getElementById('client-section');
const userEmailDisplay = document.getElementById('user-email');
const btnLogout = document.getElementById('btn-logout');
const btnLogin = document.getElementById('btn-login');

// Escuta mudanças de estado na autenticação
async function initAuth() {
    if (!window.supabaseClient) return;

    const { data: { session } } = await window.supabaseClient.auth.getSession();
    await handleSession(session);

    window.supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        await handleSession(session);
    });
}

async function handleSession(session) {
    if (session?.user) {
        authState.user = session.user;
        // Busca perfil para saber se é admin ou cliente
        authState.profile = await window.getCurrentProfile();

        if (userEmailDisplay) userEmailDisplay.textContent = authState.profile?.nome || authState.user.email;
        if (btnLogout) btnLogout.classList.remove('hidden'); // MOSTRAR BOTÃO SAIR
        if (document.getElementById('btn-profile')) document.getElementById('btn-profile').classList.remove('hidden'); // MOSTRAR BOTÃO PERFIL

        // Roteamento
        authSection.classList.add('hidden');
        if (authState.profile?.role === 'admin') {
            console.log("Usuário ADMIN detectado");
            adminSection.classList.remove('hidden');
            clientSection.classList.add('hidden');
            // Carregar dados admin se a função existir
            if (window.loadAdminDashboard) window.loadAdminDashboard();
        } else {
            console.log("Usuário CLIENTE detectado");
            clientSection.classList.remove('hidden');
            adminSection.classList.add('hidden');
            // Carregar dados cliente se a função existir
            if (window.loadClientDashboard) window.loadClientDashboard();
        }

    } else {
        authState.user = null;
        authState.profile = null;
        authSection.classList.remove('hidden');
        adminSection.classList.add('hidden');
        clientSection.classList.add('hidden');
        if (btnLogout) btnLogout.classList.add('hidden'); // ESCONDER BOTÃO SAIR
        if (document.getElementById('btn-profile')) document.getElementById('btn-profile').classList.add('hidden'); // ESCONDER BOTÃO PERFIL
    }
}

// Login
async function login(email, password) {
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        alert('Erro ao fazer login: ' + error.message);
    } else {
        console.log('Login realizado!');
        // O onAuthStateChange vai cuidar do resto
    }
}

// Cadastro (para clientes novos)
async function signup(email, password, nome, telefone, endereco) {
    // 1. Criar Auth User
    const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
        email: email,
        password: password
    });

    if (authError) {
        alert('Erro no cadastro: ' + authError.message);
        return;
    }

    // O Trigger no banco vai criar o 'profile' vazio. Vamos atualizá-lo com nome e telefone.
    if (authData.user) {
        // Pequeno delay para garantir que o trigger rodou
        setTimeout(async () => {
            const { error: profileError } = await window.supabaseClient
                .from('profiles')
                .update({ nome, telefone, endereco })
                .eq('id', authData.user.id);

            if (profileError) console.error("Erro ao atualizar perfil:", profileError);

            // UX: Mensagem amigável e redirecionamento para login
            alert(`Cadastro realizado com sucesso!\n\nEnviamos um email de confirmação para ${email}.\nPor favor, verifique sua caixa de entrada (e spam) antes de fazer login.`);

            // Voltar para tela de login visualmente
            document.getElementById('signup-form-container').classList.add('hidden');
            document.getElementById('login-form-container').classList.remove('hidden');
            document.getElementById('signup-form').reset();

        }, 1000);
    }
}

// Logout
async function logout() {
    const confirmLogout = confirm("Tem certeza que deseja sair?");
    if (confirmLogout) {
        try {
            const { error } = await window.supabaseClient.auth.signOut();
            if (error) console.error("Erro no logout Supabase:", error);
        } catch (err) {
            console.error("Exceção no logout:", err);
        } finally {
            // Força recarregamento mesmo se der erro na API
            // Limpa dados locais manualmente se necessário (backup)
            localStorage.removeItem('sb-' + SUPABASE_KEY + '-auth-token');
            location.reload();
        }
    }
}

// Event Listeners
if (btnLogin) {
    btnLogin.addEventListener('click', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const remember = document.getElementById('remember-me')?.checked;

        // Se 'Manter conectado' não estiver marcado, poderíamos forçar logout ao fechar,
        // mas o padrão do Supabase é persistir. Ajustar persistência exige configuração do Client.
        // Por simplicidade, assumimos comportamento padrão, mas o checkbox serve de UI conforme pedido.

        login(email, password);
    });
}

if (btnLogout) {
    btnLogout.addEventListener('click', logout);
}

// Tabs de Login/Cadastro (Simples toggle)
document.addEventListener('click', (e) => {
    if (e.target.id === 'show-signup') {
        e.preventDefault();
        document.getElementById('login-form-container').classList.add('hidden');
        document.getElementById('signup-form-container').classList.remove('hidden');
    } else if (e.target.id === 'show-login') {
        e.preventDefault();
        document.getElementById('signup-form-container').classList.add('hidden');
        document.getElementById('login-form-container').classList.remove('hidden');
    }
});

// Listener cadastro
const btnSignup = document.getElementById('btn-signup');
if (btnSignup) {
    btnSignup.addEventListener('click', (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const nome = document.getElementById('signup-name').value;
        const telefone = document.getElementById('signup-phone').value;
        const endereco = document.getElementById('signup-address').value;
        signup(email, password, nome, telefone, endereco);
    });
}

// Inicia
// Inicia
document.addEventListener('DOMContentLoaded', initAuth);

// --- NOVAS FUNÇÕES: Esqueci a Senha e Editar Perfil ---

// 1. Esqueci a Senha
const forgotPasswordLink = document.querySelector('a.text-blue-600.hover\\:underline'); // Seletor genérico para o link "Esqueceu a senha?"
if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;

        if (!email) {
            alert("Por favor, digite seu email no campo de login para recuperar a senha.");
            return;
        }

        const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.href, // Redireciona de volta para cá para definir nova senha
        });

        if (error) {
            alert("Erro ao enviar email: " + error.message);
        } else {
            alert(`Email de recuperação enviado para ${email}!\n\nVerifique sua caixa de entrada.`);
        }
    });
}

// 2. Lógica do Modal de Perfil (Profile & Senha)
const profileModal = document.getElementById('profile-modal');
const btnOpenProfile = document.getElementById('btn-profile'); // Teremos que criar esse botão no HTML
const btnCloseProfile = document.getElementById('close-profile-modal');
const profileForm = document.getElementById('profile-form');

// Abrir Modal e Preencher Dados
window.openProfileModal = () => {
    if (!authState.profile) return;

    // Preencher campos
    document.getElementById('edit-name').value = authState.profile.nome || '';
    document.getElementById('edit-phone').value = authState.profile.telefone || '';
    document.getElementById('edit-password').value = ''; // Senha sempre vazia

    profileModal.classList.remove('hidden');
};

// Fechar Modal
if (btnCloseProfile) {
    btnCloseProfile.addEventListener('click', () => {
        profileModal.classList.add('hidden');
    });
}

// Salvar Alterações
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newName = document.getElementById('edit-name').value;
        const newPhone = document.getElementById('edit-phone').value;
        const newPassword = document.getElementById('edit-password').value;
        const user = authState.user;

        // 1. Atualizar Profile (Nome/Telefone)
        const { error: profileError } = await window.supabaseClient
            .from('profiles')
            .update({ nome: newName, telefone: newPhone })
            .eq('id', user.id);

        if (profileError) {
            alert("Erro ao atualizar perfil: " + profileError.message);
            return;
        }

        // 2. Atualizar Senha (Se fornecida)
        if (newPassword) {
            const { error: passError } = await window.supabaseClient.auth.updateUser({ password: newPassword });
            if (passError) {
                alert("Perfil atualizado, mas ERRO ao trocar senha: " + passError.message);
                return;
            }
        }

        alert("Perfil atualizado com sucesso!");
        profileModal.classList.add('hidden');

        // Atualizar UI localmente
        authState.profile.nome = newName;
        authState.profile.telefone = newPhone;
        document.getElementById('user-email').textContent = newName || user.email;
    });
}

// Hook para detectar se o usuário está voltando de um Link de Recuperação de Senha
window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
    // Check for explicit RECOVERY event or if URL contains typical recovery params but event didn't fire yet
    const isRecovery = event === "PASSWORD_RECOVERY" || (window.location.hash && window.location.hash.includes('type=recovery'));

    if (isRecovery) {
        // Garantir que o modal abra mesmo se a UI ainda não tiver carregado 100%
        console.log("Modo de Recuperação Detectado");

        // Espera um pouco para garantir que a sessão foi estabelecida e a UI carregou (auth.js roda cedo)
        setTimeout(() => {
            if (window.openProfileModal) {
                window.openProfileModal();

                // UX: Focar no campo de senha e dar feedback visual
                const passInput = document.getElementById('edit-password');
                const modalTitle = document.querySelector('#profile-modal h3');

                if (passInput) {
                    passInput.focus();
                    passInput.placeholder = "Digite sua NOVA senha aqui";
                    passInput.parentElement.classList.add('animate-pulse'); // Destaque visual
                }

                if (modalTitle) {
                    modalTitle.innerHTML = '<i class="fas fa-key mr-2 text-yellow-500"></i> Redefinir Senha';
                }

                alert("Por favor, defina sua nova senha agora.");
            }
        }, 1500); // 1.5s delay to be safe
    }
});
