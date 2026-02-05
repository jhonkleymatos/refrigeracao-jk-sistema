// Configuração do Supabase
// Não esquecer de trocar as chaves
var SUPABASE_URL = 'https://ciadjxnblryygbsqihqd.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpYWRqeG5ibHJ5eWdic3FpaHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNTM3ODYsImV4cCI6MjA4NDYyOTc4Nn0.SPmoF4OEbLgjU25XbFpVQwZ4K7dKXOIpOv-dueuCWqk';

// Iniciando o supabase
var supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
console.log("Supabase ok");

// Pegar perfil
function getCurrentProfile() {
    // fazendo promessa manual pq eh mais facil
    return supabaseClient.auth.getUser().then(function (dados) {
        var user = dados.data.user;
        if (user) {
            return supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()
                .then(function (resp) {
                    if (resp.error) {
                        console.log("Deu erro no perfil: " + resp.error);
                        return null;
                    }
                    return resp.data;
                });
        }
        return null;
    });
}
