const express = require('express'); // Importa o framework Express
const MongoClient = require('mongodb').MongoClient; // Importa o MongoDB
const session = require('express-session'); // Biblioteca para sessões
const bcrypt = require('bcrypt'); // Biblioteca para criptografar senhas
require('dotenv').config(); // Carrega variáveis de ambiente
const OpenAI = require('openai'); // Biblioteca OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); 
const MongoStore = require('connect-mongo');

const app = express(); // Instância do Express
const porta = 3000; // Porta do servidor

// Configuração do Express para formulários e JSON
app.use(express.urlencoded({ extended: true })); 
app.use(express.json());
app.use(express.static('public'))

// Configuração do banco MongoDB
const urlMongo = "mongodb+srv://VictorEiki:Veky2309!@cluster0.dy3hg9b.mongodb.net/?appName=Cluster0";
const nomeBanco = 'sistemalogin';

// Configuração da sessão
app.use(session({
    secret: 'metalicagoat',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: urlMongo,
        collectionName: 'sessions'
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// Rota para página da home
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/home.html');
});

// Rota para página de registro
app.get('/registro', (req, res) => {
    res.sendFile(__dirname + '/views/registro.html');
});

// Registrar usuário
app.post('/registro', async (req, res) => {
    const cliente = new MongoClient(urlMongo);

    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaoUsuarios = banco.collection('usuarios');

        const usuarioExistente = await colecaoUsuarios.findOne({ usuario: req.body.usuario });

        if (usuarioExistente) {
            res.send('Usuário já existe! Tente outro nome de usuário.');
        } else {
            const senhaCriptografada = await bcrypt.hash(req.body.senha, 10);

            await colecaoUsuarios.insertOne({
                usuario: req.body.usuario,
                senha: senhaCriptografada
            });

            res.redirect('/login');
        }   
    } catch (erro) {
        res.redirect('/erro');
    } finally {
        cliente.close();
    }
});

// Página de login
app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/views/login.html');
});

// Autenticação
app.post('/login', async (req, res) => {
    const cliente = new MongoClient(urlMongo);

    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaoUsuarios = banco.collection('usuarios');

        const usuario = await colecaoUsuarios.findOne({ usuario: req.body.usuario });

        if (usuario && await bcrypt.compare(req.body.senha, usuario.senha)) {
            req.session.usuario = req.body.usuario;
            res.redirect('/usuario');
        } else {
            res.redirect('/erro');
        }
    } catch (erro) {
        res.send('Erro ao realizar login.');
    } finally {
        cliente.close();
    }
});

// Middleware para verificar autenticação
function protegerRota(req, res, next) {
    if (req.session.usuario) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Rota protegida
app.get('/bemvindo', protegerRota, (req, res) => {
    res.sendFile(__dirname + '/views/bemvindo.html');
});

// Rota para página do usuário (protegida)
app.get('/usuario', protegerRota, (req, res) => {
    res.sendFile(__dirname + '/views/usuario.html');
});

// Rota de erro
app.get('/erro', (req, res) => {
    res.sendFile(__dirname + '/views/erro.html');
});

// Logout
app.get('/sair', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.send('Erro ao sair!');
        }
        res.redirect('/login');
    });
});

// Rota para geração de resumos
app.post('/api/gerar-resumo', protegerRota, async (req, res) => {
    try {
        const prompt = "Resuma o seguinte conteúdo de vídeo: " + (req.body.texto || "Conteúdo do vídeo aqui.");
        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }]
        });
        res.json({ resumo: completion.data.choices[0].message.content });
    } catch (erro) {
        res.json({ resumo: "Erro ao gerar resumo." });
    }
});

// Rota para recomendação de vídeos
app.post('/api/recomendar-videos', protegerRota, async (req, res) => {
    try {
        const prompt = "Sugira 3 títulos de vídeo para o tema: " + (req.body.tema || "educação");
        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }]
        });
        res.json({ videos: completion.data.choices[0].message.content.split('\n').filter(Boolean) });
    } catch (erro) {
        res.json({ videos: ["Erro ao recomendar vídeos."] });
    }
});

// Rota para página de suporte (Chatbot)
app.get('/suporte', protegerRota, (req, res) => {
    res.sendFile(__dirname + '/views/suporte.html');
});

// Rota para o chatbot
app.post('/api/chatbot', protegerRota, async (req, res) => {
    try {
        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: req.body.mensagem }]
        });
        res.json({ resposta: completion.data.choices[0].message.content });
    } catch (erro) {
        res.json({ resposta: "Erro ao responder. Tente novamente." });
    }
});

// Inicializar servidor
app.listen(porta, () => {
    console.log(`Servidor rodando em http://localhost:${porta}`);
});
