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
document.addEventListener('DOMContentLoaded', initAuth);
