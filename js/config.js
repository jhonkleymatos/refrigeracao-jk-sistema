// Configuração do Supabase e Utilitários Globais
// IMPORTANTE: Substitua as chaves abaixo pelas chaves do seu projeto Supabase
const SUPABASE_URL = 'https://ciadjxnblryygbsqihqd.supabase.co';
// Usando a chave correta (Anon JWT) que foi configurada anteriormente.
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpYWRqeG5ibHJ5eWdic3FpaHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNTM3ODYsImV4cCI6MjA4NDYyOTc4Nn0.SPmoF4OEbLgjU25XbFpVQwZ4K7dKXOIpOv-dueuCWqk';

// Inicializa o cliente Supabase globalmente
if (typeof supabase !== 'undefined') {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase inicializado!");
} else {
    console.error("Biblioteca Supabase não encontrada. Verifique o CDN no index.html.");
}

// Função auxiliar para buscar o perfil do usuário logado
window.getCurrentProfile = async () => {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error("Erro ao buscar perfil:", error);
        return null;
    }
    return profile;
};
