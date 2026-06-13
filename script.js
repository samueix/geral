/**
 * PORTAL INTELIGENTE - CORE JAVASCRIPT ENGINE
 * Arquivo totalmente modularizado em vanilla JS com persistência de estado.
 */

// ==========================================================================
// CONFIGURAÇÕES, CHAVES DE API (MOCK / PLACEHOLDERS) E CONFIGS DE ACESSO
// ==========================================================================
const CONFIG = {
    // Para utilizar em produção real, substitua as chaves abaixo pelas suas credenciais das plataformas.
    NEWS_API_KEY: 'DEMO_MOCK_KEY', 
    TMDB_API_KEY: 'DEMO_MOCK_KEY',
    FOOTBALL_API_KEY: 'DEMO_MOCK_KEY',
    
    // Intervalos de sincronismo
    INTERVAL_COTACOES: 5 * 60 * 1000, // 5 Minutos
    INTERVAL_CLIMA: 15 * 60 * 1000,   // 15 Minutos
};

// ESTADO GLOBAL DO DASHBOARD (PERSISTENTE)
let state = {
    stats: {
        newsLoaded: 0,
        cepConsults: 0,
        refreshCount: 0
    },
    favoritos: {
        noticias: [],
        filmes: []
    },
    theme: 'dark',
    petType: 'cat'
};

// ==========================================================================
// MONITOR DE INICIALIZAÇÃO E EVENTOS CENTRALIZADOS
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    carregarEstadoLocalStorage();
    inicializarRelogio();
    inicializarMenuSistemas();
    inicializarListeners();
    
    // Disparos de conexões assíncronas assíncronas paralelas das APIs
    atualizarTodoPortal().then(() => {
        // Esconde o Splash Screen Global com fade suave
        const loader = document.getElementById('global-loading');
        if(loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 400);
        }
    });
});

// EVENT LISTENERS DO PORTAL
function inicializarListeners() {
    // Botões de Ações Globais
    document.getElementById('btn-refresh-all').addEventListener('click', () => {
        atualizarTodoPortal();
        mostrarToast("Todos os dados foram atualizados com sucesso!", "success");
    });
    
    document.getElementById('btn-theme-toggle').addEventListener('click', alternarTemaVisual);
    document.getElementById('global-search').addEventListener('input', filtrarModulosDashboard);
    
    // Listeners Individuais de Módulos
    document.getElementById('btn-buscar-cep').addEventListener('click', executarConsultaCEP);
    document.getElementById('input-cep').addEventListener('keyup', (e) => { if(e.key === 'Enter') executarConsultaCEP(); });
    document.getElementById('btn-nova-frase').addEventListener('click', buscarFraseMotivacional);
    document.getElementById('btn-nova-piada').addEventListener('click', buscarPiadaAleatoria);
    document.getElementById('btn-nova-imagem').addEventListener('click', buscarImagemPetAleatoria);
    
    // Seletores de Tipo de Pets
    document.getElementById('btn-pet-cat').addEventListener('click', () => alternarTipoPet('cat'));
    document.getElementById('btn-pet-dog').addEventListener('click', () => alternarTipoPet('dog'));

    // Network Monitor (Online/Offline)
    window.addEventListener('online', tratarMudancaRede);
    window.addEventListener('offline', tratarMudancaRede);
}

// ==========================================================================
// CORE LAYOUT ENGINE (INTERFACE, MENU, TEMAS, RECURSOS VISUAIS)
// ==========================================================================
function inicializarMenuSistemas() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    const openMobileBtn = document.getElementById('btn-open-sidebar');
    
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const icon = toggleBtn.querySelector('i');
        if(sidebar.classList.contains('collapsed')) {
            icon.className = "fa-solid fa-chevron-right";
        } else {
            icon.className = "fa-solid fa-chevron-left";
        }
    });

    openMobileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if(window.innerWidth <= 768 && !sidebar.contains(e.target) && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    });
}

function inicializarRelogio() {
    const timeEl = document.getElementById('header-time');
    const dateEl = document.getElementById('header-date');
    
    setInterval(() => {
        const agora = new Date();
        timeEl.textContent = agora.toLocaleTimeString('pt-BR');
        dateEl.textContent = agora.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }, 1000);
}

function alternarTemaVisual() {
    const body = document.body;
    const themeIcon = document.getElementById('btn-theme-toggle').querySelector('i');
    
    if(body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
        themeIcon.className = "fa-solid fa-moon";
        state.theme = 'light';
    } else {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme');
        themeIcon.className = "fa-solid fa-sun";
        state.theme = 'dark';
    }
    salvarEstadoLocalStorage();
}

// TOAST ENGINE SYSTEM
function mostrarToast(mensagem, tipo = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerText = mensagem;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// BUSCA / FILTRO GLOBAL NO DASHBOARD
function filtrarModulosDashboard(e) {
    const termo = e.target.value.toLowerCase().trim();
    const cards = document.querySelectorAll('.search-target');
    
    cards.forEach(card => {
        const metadados = card.getAttribute('data-search-name') || '';
        const id = card.id || '';
        const textoInterno = card.textContent.toLowerCase();
        
        if(termo === '' || metadados.includes(termo) || id.includes(termo) || textoInterno.includes(termo)) {
            card.classList.remove('search-fade');
        } else {
            card.classList.add('search-fade');
        }
    });
}

function tratarMudancaRede() {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    if(navigator.onLine) {
        statusDot.className = "status-dot online";
        statusText.textContent = "Online";
        mostrarToast("Conexão com a internet restabelecida!", "success");
    } else {
        statusDot.className = "status-dot offline";
        statusText.textContent = "Offline";
        mostrarToast("Você está desconectado. Algumas funções podem falhar.", "error");
    }
}

// ==========================================================================
// DATA ENGINE INTEGRATION - CONSUMO ASYNC DE RECURSOS API API
// ==========================================================================

async function atualizarTodoPortal() {
    state.stats.refreshCount++;
    atualizarPainelEstatisticas();
    
    // Chamadas assíncronas paralelas tratadas individualmente contra falhas cascata
    await Promise.all([
        buscarClimaTempo(),
        buscarCotacoesMoedas(),
        buscarNoticiasPortais(),
        buscarFeriadosNacionais(),
        buscarFraseMotivacional(),
        buscarPiadaAleatoria(),
        buscarImagemPetAleatoria(),
        renderizarFutebolMock(),
        buscarFilmesPopularesTMDb()
    ]);
    
    salvarEstadoLocalStorage();
}

// 1. CLIMA EM TEMPO REAL (OPEN-METEO API - Coordenadas Fortaleza como Padrão)
async function buscarClimaTempo() {
    const container = document.getElementById('clima-container');
    const loading = document.getElementById('clima-loading');
    
    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-3.7172&longitude=-38.5434&current_weather=true&timezone=America/Fortaleza');
        if(!res.ok) throw new Error();
        const data = await res.json();
        
        const cw = data.current_weather;
        document.getElementById('clima-temp').textContent = `${Math.round(cw.temperature)}°C`;
        document.getElementById('clima-wind').textContent = `${cw.windspeed} km/h`;
        document.getElementById('clima-desc').textContent = mapearCodigoClimaMeteo(cw.weathercode);
        
        loading.classList.add('hidden');
        container.classList.remove('hidden');
    } catch (error) {
        document.getElementById('clima-desc').textContent = "Erro ao buscar clima.";
        loading.classList.add('hidden');
        container.classList.remove('hidden');
    }
}

function mapearCodigoClimaMeteo(code) {
    // Mapeamento simplificado de códigos WMO Open-Meteo
    if([0].includes(code)) return "Céu Limpo";
    if([1, 2, 3].includes(code)) return "Parcialmente Nublado";
    if([45, 48].includes(code)) return "Névoa Úmida";
    if([51, 53, 55, 61, 63, 65].includes(code)) return "Chuva Leve / Moderada";
    if([71, 73, 75, 77, 80, 81, 82].includes(code)) return "Pancadas de Chuva";
    if([95, 96, 99].includes(code)) return "Tempestade Ativa";
    return "Condições Normais";
}

// 2. COTAÇÃO DE MOEDAS (AWESOMEAPI)
async function buscarCotacoesMoedas() {
    const container = document.getElementById('moedas-container');
    const loading = document.getElementById('moedas-loading');
    
    try {
        const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL');
        if(!res.ok) throw new Error();
        const data = await res.json();
        
        document.getElementById('moeda-dolar').textContent = `R$ ${parseFloat(data.USDBRL.bid).toFixed(2)}`;
        document.getElementById('moeda-euro').textContent = `R$ ${parseFloat(data.EURBRL.bid).toFixed(2)}`;
        document.getElementById('moeda-bitcoin').textContent = `R$ ${parseFloat(data.BTCBRL.bid).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        
        loading.classList.add('hidden');
        container.classList.remove('hidden');
    } catch (error) {
        loading.classList.add('hidden');
        mostrarToast("Erro ao sincronizar moedas.", "error");
    }
}

// 3. NOTÍCIAS COMPACTAS (NEWSAPI OU MOCK SEGURO CASO SEM CHAVE)
async function buscarNoticiasPortais() {
    const grid = document.getElementById('noticias-grid');
    const loading = document.getElementById('noticias-loading');
    grid.innerHTML = '';
    
    try {
        let artigos = [];
        
        if (CONFIG.NEWS_API_KEY === 'DEMO_MOCK_KEY') {
            // Fallback robusto/Mock estruturado para demonstração imediata funcional
            artigos = [
                { title: "Avanço da Inteligência Artificial em 2026", description: "Novos modelos computacionais atingem capacidades cognitivas avançadas e mudam o mercado técnico global.", url: "#", urlToImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500" },
                { title: "Desenvolvimento Sustentável nas Cidades", description: "Projetos arquitetônicos focados em triplex ecológicos e reaproveitamento energético ganham espaço.", url: "#", urlToImage: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500" },
                { title: "Segurança Digital e Engenharia Reversa", description: "Especialistas alertam para novos pacotes de vetores maliciosos e ensinam mitigações estruturadas.", url: "#", urlToImage: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=500" }
            ];
        } else {
            const res = await fetch(`https://newsapi.org/v2/top-headlines?country=br&apiKey=${CONFIG.NEWS_API_KEY}`);
            if(!res.ok) throw new Error();
            const data = await res.json();
            artigos = data.articles.slice(0, 3);
        }
        
        artigos.forEach((art, index) => {
            state.stats.newsLoaded++;
            const isFav = state.favoritos.noticias.some(n => n.title === art.title);
            
            const card = document.createElement('div');
            card.className = "news-card";
            card.innerHTML = `
                <img class="news-thumb" src="${art.urlToImage || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=500'}" alt="Notícia">
                <div class="news-content">
                    <h4>${art.title}</h4>
                    <p>${art.description || 'Clique no link para ler os detalhes completos sobre este acontecimento no portal oficial.'}</p>
                    <div class="news-footer">
                        <a href="${art.url}" target="_blank" class="btn-link">Ler Mais <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                        <button class="btn-fav-toggle ${isFav ? 'active' : ''}" onclick="alternarFavoritoItem('noticias', ${JSON.stringify(art).replace(/"/g, '&quot;')}, this)">
                            <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star"></i>
                        </button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
        
        atualizarPainelEstatisticas();
        loading.classList.add('hidden');
        grid.classList.remove('hidden');
    } catch (error) {
        loading.classList.add('hidden');
        grid.innerHTML = `<p class="empty-msg">Não foi possível carregar as notícias em tempo real.</p>`;
        grid.classList.remove('hidden');
    }
}

// 4. CONSULTA CEP LOCALIZADA (VIACEP)
async function executarConsultaCEP() {
    const rawCep = document.getElementById('input-cep').value;
    const cep = rawCep.replace(/\D/g, '');
    const resultBox = document.getElementById('cep-result');
    
    if(cep.length !== 8) {
        mostrarToast("CEP Inválido! Certifique-se de digitar 8 números.", "error");
        return;
    }
    
    resultBox.innerHTML = `<div class="spinner small"></div>`;
    resultBox.classList.remove('hidden');
    
    try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        
        if(data.erro) {
            resultBox.innerHTML = `<p style="color:var(--color-red);">CEP não localizado na base dos Correios.</p>`;
            return;
        }
        
        state.stats.cepConsults++;
        atualizarPainelEstatisticas();
        salvarEstadoLocalStorage();
        
        resultBox.innerHTML = `
            <div class="cep-result-line"><strong>Rua:</strong> ${data.logradouro || 'Não cadastrado'}</div>
            <div class="cep-result-line"><strong>Bairro:</strong> ${data.bairro || 'Não cadastrado'}</div>
            <div class="cep-result-line"><strong>Cidade:</strong> ${data.localidade}</div>
            <div class="cep-result-line"><strong>Estado:</strong> ${data.uf}</div>
        `;
    } catch (error) {
        resultBox.innerHTML = `<p style="color:var(--color-red);">Erro ao processar consulta remota.</p>`;
    }
}

// 5. FERIADOS DO BRASIL (BRASILAPI)
async function buscarFeriadosNacionais() {
    const lista = document.getElementById('feriados-lista');
    const loading = document.getElementById('feriados-loading');
    lista.innerHTML = '';
    
    try {
        const anoAtual = new Date().getFullYear();
        const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${anoAtual}`);
        if(!res.ok) throw new Error();
        const data = await res.json();
        
        // Filtra os próximos feriados com base na data de hoje
        const hojeStr = new Date().toISOString().split('T')[0];
        const proximos = data.filter(f => f.date >= hojeStr).slice(0, 5);
        
        proximos.forEach(f => {
            const li = document.createElement('li');
            li.className = "feriado-item";
            const [ano, mes, dia] = f.date.split('-');
            li.innerHTML = `
                <span>${f.name}</span>
                <span class="feriado-date">${dia}/${mes}</span>
            `;
            lista.appendChild(li);
        });
        
        loading.classList.add('hidden');
        lista.classList.remove('hidden');
    } catch (error) {
        loading.classList.add('hidden');
        lista.innerHTML = `<p class="empty-msg">Calendário indisponível.</p>`;
        lista.classList.remove('hidden');
    }
}

// 6. FRASE INSPIRACIONAL (API INSPIRACIONAL RANDOM SLOW BACKUP)
async function buscarFraseMotivacional() {
    const box = document.getElementById('frase-box');
    const autor = document.getElementById('frase-autor');
    
    try {
        // Consome API aberta sem autenticação
        const res = await fetch('https://api.quotable.io/random?tags=motivational|inspirational');
        if(!res.ok) throw new Error();
        const data = await res.json();
        box.textContent = `"${data.content}"`;
        autor.textContent = `- ${data.author}`;
    } catch (error) {
        // Fallback local seguro para evitar que o bloco quebre sem internet ou sob rate limit
        const fallbacks = [
            { c: "A persistência é o caminho do êxito.", a: "Charles Chaplin" },
            { c: "Código limpo sempre parece que foi escrito por alguém que se importa.", a: "Michael Feathers" },
            { c: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", a: "Robert Collier" }
        ];
        const r = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        box.textContent = `"${r.c}"`;
        autor.textContent = `- ${r.a}`;
    }
}

// 7. QUEBRAR O GELO / PIADAS (OFFICIAL JOKE API)
async function buscarPiadaAleatoria() {
    const setup = document.getElementById('joke-setup');
    const delivery = document.getElementById('joke-delivery');
    delivery.classList.add('hidden');
    
    try {
        const res = await fetch('https://official-joke-api.appspot.com/random_joke');
        if(!res.ok) throw new Error();
        const data = await res.json();
        
        setup.textContent = data.setup;
        setTimeout(() => {
            delivery.textContent = data.punchline;
            delivery.classList.remove('hidden');
        }, 1500); // Gera suspense controlado para entrega do trocadilho
    } catch (error) {
        setup.textContent = "Por que o programador faliu?";
        delivery.textContent = "Porque ele gastou todo o seu 'cache'.";
        delivery.classList.remove('hidden');
    }
}

// 8. PETS IMAGENS DINÂMICAS (THECATAPI / THEDOGAPI)
async function buscarImagemPetAleatoria() {
    const img = document.getElementById('random-pet-img');
    const loading = document.getElementById('image-loading');
    
    img.classList.add('hidden');
    loading.classList.remove('hidden');
    
    let url = state.petType === 'cat' 
        ? 'https://api.thecatapi.com/v1/images/search' 
        : 'https://api.thedogapi.com/v1/images/search';
        
    try {
        const res = await fetch(url);
        if(!res.ok) throw new Error();
        const data = await res.json();
        
        img.src = data[0].url;
        img.onload = () => {
            loading.classList.add('hidden');
            img.classList.remove('hidden');
        };
    } catch (error) {
        img.src = "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400";
        loading.classList.add('hidden');
        img.classList.remove('hidden');
    }
}

function alternarTipoPet(tipo) {
    state.petType = tipo;
    document.getElementById('btn-pet-cat').classList.toggle('active', tipo === 'cat');
    document.getElementById('btn-pet-dog').classList.toggle('active', tipo === 'dog');
    buscarImagemPetAleatoria();
}

// 9. CENTRAL ESPORTIVA E FUTEBOL (ESTRUTURA PREPARADA PARA API-FOOTBALL COM MOCK)
function renderizarFutebolMock() {
    const jogosContainer = document.getElementById('futebol-jogos');
    const tabelaBody = document.querySelector('#tabela-futebol tbody');
    
    // Simulação exata dos dados retornados pela v3.api-football
    const jogosMock = [
        { home: "Fortaleza", away: "Ceará", score: "2 - 1" },
        { home: "Flamengo", away: "Palmeiras", score: "0 - 0" },
        { home: "São Paulo", away: "Santos", score: "3 - 2" }
    ];
    
    const tabelaMock = [
        { pos: 1, nome: "Fortaleza", p: 28, j: 12, v: 8 },
        { pos: 2, nome: "Botafogo", p: 25, j: 12, v: 7 },
        { pos: 3, nome: "Palmeiras", p: 22, j: 12, v: 6 },
        { pos: 4, nome: "Flamengo", p: 21, j: 12, v: 6 }
    ];
    
    jogosContainer.innerHTML = jogosMock.map(j => `
        <div class="match-item">
            <span class="match-team home">${j.home}</span>
            <span class="match-score">${j.score}</span>
            <span class="match-team away">${j.away}</span>
        </div>
    `).join('');
    
    tabelaBody.innerHTML = tabelaMock.map(t => `
        <tr>
            <td><strong>${t.pos}º</strong></td>
            <td>${t.nome}</td>
            <td><strong>${t.p}</strong></td>
            <td>${t.j}</td>
            <td>${t.v}</td>
        </tr>
    `).join('');
}

// 10. TENDÊNCIAS DO CINEMA - FILMES (TMDB COM ESTRUTURA E FALLBACK INTEGRADO)
async function buscarFilmesPopularesTMDb() {
    const grid = document.getElementById('filmes-grid');
    const loading = document.getElementById('filmes-loading');
    grid.innerHTML = '';
    
    try {
        let filmes = [];
        
        if(CONFIG.TMDB_API_KEY === 'DEMO_MOCK_KEY') {
            // Estrutura idêntica ao retorno do endpoint /movie/popular do TMDb
            filmes = [
                { id: 101, title: "Interestelar 2", vote_average: 8.9, overview: "Explorações espaciais profundas e equações físicas desafiam os limites dimensionais em busca de uma nova colônia galáctica.", poster_path: "/gEU2v6wG7wCttvbbCBjIGg7gGv3.jpg", backdrop_fallback: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400" },
                { id: 102, title: "O Código Cripto", vote_average: 7.6, overview: "Um analista de digital forensics descobre uma brecha em servidores globais e inicia uma corrida contra o tempo.", poster_path: "/nMKgOPE886gT8t8bA.jpg", backdrop_fallback: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400" }
            ];
        } else {
            const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${CONFIG.TMDB_API_KEY}&language=pt-BR&page=1`);
            if(!res.ok) throw new Error();
            const data = await res.json();
            filmes = data.results.slice(0, 4);
        }
        
        filmes.forEach(m => {
            const isFav = state.favoritos.filmes.some(f => f.id === m.id);
            const imgSrc = m.poster_path && CONFIG.TMDB_API_KEY !== 'DEMO_MOCK_KEY' 
                ? `https://image.tmdb.org/t/p/w500${m.poster_path}` 
                : (m.backdrop_fallback || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400");
                
            const card = document.createElement('div');
            card.className = "movie-card";
            card.innerHTML = `
                <img class="movie-poster" src="${imgSrc}" alt="${m.title}">
                <div class="movie-rating"><i class="fa-solid fa-star"></i> ${m.vote_average.toFixed(1)}</div>
                <div class="movie-info">
                    <h4>${m.title}</h4>
                    <p>${m.overview || 'Sinopse não fornecida pela distribuidora oficial para esta localidade.'}</p>
                    <div class="news-footer" style="margin-top:auto; padding-top:10px;">
                        <span style="font-size:0.75rem; color:var(--text-light)">TMDb Core</span>
                        <button class="btn-fav-toggle ${isFav ? 'active' : ''}" onclick="alternarFavoritoItem('filmes', ${JSON.stringify(m).replace(/"/g, '&quot;')}, this)">
                            <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star"></i>
                        </button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
        
        loading.classList.add('hidden');
        grid.classList.remove('hidden');
    } catch (error) {
        loading.classList.add('hidden');
        grid.innerHTML = `<p class="empty-msg">Indisponibilidade temporária na API TMDb.</p>`;
        grid.classList.remove('hidden');
    }
}

// ==========================================================================
// CORE PERSISTENCE LAYER (LOCALSTORAGE, ESTADO E CONTROLE FAVORITOS)
// ==========================================================================

function alternarFavoritoItem(tipo, item, elementoBotao) {
    let lista = state.favoritos[tipo];
    const itemIdentificador = tipo === 'noticias' ? item.title : item.id;
    const index = lista.findIndex(x => (tipo === 'noticias' ? x.title : x.id) === itemIdentificador);
    
    if(index > -1) {
        lista.splice(index, 1);
        elementoBotao.classList.remove('active');
        elementoBotao.querySelector('i').className = "fa-regular fa-star";
        mostrarToast("Removido dos seus Favoritos.", "info");
    } else {
        lista.push(item);
        elementoBotao.classList.add('active');
        elementoBotao.querySelector('i').className = "fa-solid fa-star";
        mostrarToast("Adicionado aos seus Favoritos!", "success");
    }
    
    salvarEstadoLocalStorage();
    renderizarPainelFavoritos();
}

function renderizarPainelFavoritos() {
    const newsWrapper = document.getElementById('fav-news-list');
    const moviesWrapper = document.getElementById('fav-movies-list');
    
    // Atualização da lista de Notícias Favoritas
    if(state.favoritos.noticias.length === 0) {
        newsWrapper.innerHTML = `<p class="empty-msg">Nenhuma notícia favoritada ainda.</p>`;
    } else {
        newsWrapper.innerHTML = state.favoritos.noticias.map(n => `
            <div class="fav-item-row">
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:85%;">${n.title}</span>
                <button class="btn-fav-toggle active" onclick='removerFavoritoDireto("noticias", "title", "${n.title.replace(/'/g, "\\'")}")'>
                    <i class="fa-solid fa-trash" style="color:var(--color-red); font-size:0.8rem;"></i>
                </button>
            </div>
        `).join('');
    }
    
    // Atualização da lista de Filmes Favoritos
    if(state.favoritos.filmes.length === 0) {
        moviesWrapper.innerHTML = `<p class="empty-msg">Nenhum filme favoritado ainda.</p>`;
    } else {
        moviesWrapper.innerHTML = state.favoritos.filmes.map(m => `
            <div class="fav-item-row">
                <span>${m.title}</span>
                <button class="btn-fav-toggle active" onclick='removerFavoritoDireto("filmes", "id", ${m.id})'>
                    <i class="fa-solid fa-trash" style="color:var(--color-red); font-size:0.8rem;"></i>
                </button>
            </div>
        `).join('');
    }
}

function removerFavoritoDireto(tipo, propriedadeChave, valorChave) {
    state.favoritos[tipo] = state.favoritos[tipo].filter(x => x[propriedadeChave] !== valorChave);
    salvarEstadoLocalStorage();
    renderizarPainelFavoritos();
    
    // Sincroniza o estado visual do card principal se ele estiver renderizado em tela
    buscarNoticiasPortais();
    buscarFilmesPopularesTMDb();
    mostrarToast("Item removido dos favoritos.", "info");
}

function atualizarPainelEstatisticas() {
    document.getElementById('stat-news-count').textContent = state.stats.newsLoaded;
    document.getElementById('stat-cep-count').textContent = state.stats.cepConsults;
    document.getElementById('stat-refresh-count').textContent = state.stats.refreshCount;
}

function salvarEstadoLocalStorage() {
    localStorage.setItem('portal_inteligente_state', JSON.stringify(state));
}

function carregarEstadoLocalStorage() {
    const salvo = localStorage.getItem('portal_inteligente_state');
    if(salvo) {
        try {
            const parsed = JSON.parse(salvo);
            // Faz o merge seguro contra estados nulos ou propriedades novas estruturais
            state = { ...state, ...parsed };
            state.stats = parsed.stats || state.stats;
            state.favoritos = parsed.favoritos || state.favoritos;
        } catch (e) {
            console.error("Falha ao recuperar registros do localStorage.");
        }
    }
    
    // Sincroniza o tema visual persistido
    if(state.theme === 'light') {
        document.body.className = 'light-theme';
        document.getElementById('btn-theme-toggle').querySelector('i').className = "fa-solid fa-moon";
    }
    
    atualizarPainelEstatisticas();
    renderizarPainelFavoritos();
}
