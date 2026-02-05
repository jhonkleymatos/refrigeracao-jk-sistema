
// Elementos da UI
var loginForm = document.getElementById('login-form');
var div_auth = document.getElementById('auth-section');

// Escuta mudanças de estado na autenticação
function initAuth() {
    // verifica a sessao
    supabaseClient.auth.getSession().then(function (dados) {
        tratarSessao(dados.data.session);
    });

    supabaseClient.auth.onAuthStateChange(function (evt, sessao) {
        tratarSessao(sessao);
    });
}

function tratarSessao(sessao) {
    if (sessao && sessao.user) {
        // Redireciona se ja estiver logado
        getCurrentProfile().then(function (p) {
            if (p && p.role == 'admin') {
                window.location.href = '../admin/index.html';
            } else {
                window.location.href = '../cliente/index.html';
            }
        });
    }
}

// Login logic from auth.js
function login(email, password) {
    supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    }).then(function (resp) {
        if (resp.error) {
            alert('Erro no login: ' + resp.error.message);
        } else {
            console.log('Logou');
        }
    });
}

function signup(email, password, nome, telefone, endereco) {
    supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            emailRedirectTo: window.location.origin + '/login/index.html'
        }
    }).then(function (resp) {
        if (resp.error) {
            alert('Deu ruim no cadastro: ' + resp.error.message);
            return;
        }

        var user = resp.data.user;
        if (user) {
            setTimeout(function () {
                supabaseClient
                    .from('profiles')
                    .update({ nome: nome, telefone: telefone, endereco: endereco })
                    .eq('id', user.id)
                    .then(function (r) {
                        if (r.error) console.log("Erro perfil: " + r.error.message);
                        alert("Cadastrado! Veja seu email (" + email + ") para confirmar.");
                        document.getElementById('signup-form-container').classList.add('hidden');
                        document.getElementById('login-form-container').classList.remove('hidden');
                        passInput.parentElement.classList.add('request-pulse'); // Destaque visual
                    });
            }, 1000);
        }
    });
}

const btnLogin = document.getElementById('btn-login');
if (btnLogin) {
    btnLogin.addEventListener('click', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        login(email, password);
    });
}

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

document.addEventListener('DOMContentLoaded', initAuth);
