/* ===================================================================== */
/* REDE VIZINHA - JAVASCRIPT MODULAR PRINCIPAL (APP.JS)                  */
/* ===================================================================== */

/* ===================================================================== */
/* INICIALIZAÇÃO E PERSISTÊNCIA DO LOCALSTORAGE                          */
/* ===================================================================== */

// Dados iniciais padrão do Flex Osasco 2 caso o localStorage esteja vazio
const defaultPosts = [
    {
        id: "1",
        entrepreneurId: "ent_mariana",
        author: "Mariana Silva",
        location: "Torre Ipê - Apto 74",
        phone: "11998765432",
        instagram: "@mari.docuras",
        title: "Doces Artesanais, Bolos Festivos e Pão de Mel",
        category: "Gastronomia",
        coverImage: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&auto=format&fit=crop&q=80",
        priceHighlight: "A partir de R$ 6,00",
        description: "Olá, vizinhos! Faço doces gourmet e bolos artesanais com entrega gratuita direto na sua porta no Flex Osasco 2.",
        rating: 4.9,
        indicationsCount: 17,
        items: [
            { name: "Pão de Mel Tradicional Recheado", price: "R$ 7,50", available: true },
            { name: "Bolo no Pote (Morango)", price: "R$ 14,00", available: true }
        ],
        testimonials: [{ author: "Eduardo - Torre 1", text: "Excelente qualidade!" }]
    },
    {
        id: "2",
        entrepreneurId: "ent_carlos",
        author: "Carlos E. Mendes",
        location: "Torre Jatobá - Apto 142",
        phone: "11987654321",
        instagram: "@carlos.reparos",
        title: "Eletricista Residencial & Instalações",
        category: "Manutenção & Reformas",
        coverImage: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&auto=format&fit=crop&q=80",
        priceHighlight: "Orçamento sem custo",
        description: "Técnico formado com mais de 8 anos de experiência em condomínios.",
        rating: 4.8,
        indicationsCount: 12,
        items: [
            { name: "Instalação de Ventilador de Teto", price: "R$ 80,00", available: true },
            { name: "Troca de Chuveiro Elétrico", price: "R$ 45,00", available: true }
        ],
        testimonials: [{ author: "Marcio - Torre 2", text: "Rápido e honesto." }]
    }
];

const defaultRequests = [
    {
        id: "r1",
        author: "Juliana - Torre 3",
        category: "Manutenção & Reformas",
        title: "Alguém indica uma diarista de confiança para sexta-feira?",
        details: "Preciso de limpeza caprichada para apto de 2 dormitórios.",
        createdAt: "Hoje",
        replies: [{ from: "Carla - Torre 3", text: "Indico a dona Neusa!" }]
    }
];

// Carrega do localStorage ou inicializa com os padrões se não existirem
let posts = JSON.parse(localStorage.getItem('rv_posts'));
if (!posts) {
    posts = defaultPosts;
    localStorage.setItem('rv_posts', JSON.stringify(posts));
}

let requests = JSON.parse(localStorage.getItem('rv_requests'));
if (!requests) {
    requests = defaultRequests;
    localStorage.setItem('rv_requests', JSON.stringify(requests));
}

// Estado da Sessão Atual
let currentSession = JSON.parse(localStorage.getItem('rv_session')) || {
    userId: null,
    userType: "morador",
    name: "Morador Visitante"
};

function saveToStorage() {
    localStorage.setItem('rv_posts', JSON.stringify(posts));
    localStorage.setItem('rv_requests', JSON.stringify(requests));
    localStorage.setItem('rv_session', JSON.stringify(currentSession));
}
];

let requests = JSON.parse(localStorage.getItem('rv_requests')) || [
    {
        id: "r1",
        author: "Juliana - Torre 3",
        category: "Manutenção & Reformas",
        title: "Alguém indica uma diarista de confiança para sexta-feira?",
        details: "Preciso de limpeza caprichada para apto de 2 dormitórios.",
        createdAt: "Hoje",
        replies: [{ from: "Carla - Torre 3", text: "Indico a dona Neusa!" }]
    }
];

// Sessão Ativa simulada para o MVP (Empreendedor logado por padrão na demo)
let currentSession = {
    userId: "ent_mariana", // ID associado à Mariana Silva
    userType: "empreendedor", // "morador" ou "empreendedor"
    name: "Mariana Silva"
};

// Sincronizar com localStorage
function saveToStorage() {
    localStorage.setItem('rv_posts', JSON.stringify(posts));
    localStorage.setItem('rv_requests', JSON.stringify(requests));
}

// Inicializador da Página Pública (index.html ou mural.html)
function initPublicApp() {
    renderCategories();
    renderPosts();
    renderRequests();
}

// Renderizar Categorias no Catálogo
function renderCategories() {
    const container = document.getElementById('categoriesBar');
    if (!container) return;
    container.innerHTML = categories.map(cat => {
        const isActive = cat === selectedCategory;
        const activeClass = isActive
            ? "bg-slate-900 text-white shadow-sm font-semibold"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium";
        return `
            <button onclick="setCategory('${cat}')" class="px-3.5 py-1.5 rounded-full whitespace-nowrap transition text-xs shrink-0 ${activeClass}">
                ${cat}
            </button>
        `;
    }).join('');
}

let selectedCategory = "Todos";
let searchQuery = "";
let currentModalId = null;

function setCategory(cat) {
    selectedCategory = cat;
    renderCategories();
    renderPosts();
}

function filterPosts() {
    searchQuery = document.getElementById('searchInput')?.value.toLowerCase().trim() || "";
    renderPosts();
}

// Renderizar Vitrines e Serviços Públicos
function renderPosts() {
    const grid = document.getElementById('postsGrid');
    const emptyState = document.getElementById('emptyState');
    const countLabel = document.getElementById('resultsCount');
    if (!grid) return;

    const filtered = posts.filter(post => {
        const matchCategory = selectedCategory === "Todos" || post.category === selectedCategory;
        const matchSearch = !searchQuery ||
            post.title.toLowerCase().includes(searchQuery) ||
            post.description.toLowerCase().includes(searchQuery) ||
            post.author.toLowerCase().includes(searchQuery) ||
            post.location.toLowerCase().includes(searchQuery);
        return matchCategory && matchSearch;
    });

    if (countLabel) countLabel.innerText = `${filtered.length} anúncio(s) encontrado(s)`;

    if (filtered.length === 0) {
        grid.innerHTML = "";
        emptyState?.classList.remove('hidden');
        return;
    }

    emptyState?.classList.add('hidden');
    grid.innerHTML = filtered.map(post => `
        <article class="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between group">
            <div>
                <div class="relative h-44 w-full bg-slate-100 overflow-hidden cursor-pointer" onclick="openDetailModal('${post.id}')">
                    <img src="${post.coverImage}" alt="${post.title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                    <div class="absolute top-2.5 left-2.5">
                        <span class="bg-white/95 text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">${post.category}</span>
                    </div>
                    <div class="absolute bottom-2.5 left-2.5 bg-slate-900/90 text-white text-xs px-2.5 py-1 rounded-xl font-bold flex items-center space-x-1">
                        <span class="text-amber-400">★</span>
                        <span>${post.rating || 5.0}</span>
                        <span class="text-slate-400">•</span>
                        <span class="text-emerald-300">👥 ${post.indicationsCount || 1}</span>
                    </div>
                </div>
                <div class="p-4">
                    <div class="flex items-center text-xs text-slate-500 mb-1 space-x-1.5">
                        <span class="font-medium text-slate-700">${post.author}</span>
                        <span>•</span>
                        <span>${post.location}</span>
                    </div>
                    <h3 onclick="openDetailModal('${post.id}')" class="font-bold text-slate-900 text-base cursor-pointer hover:text-brand-600 transition line-clamp-2 mb-1">${post.title}</h3>
                    <p class="text-xs text-slate-600 line-clamp-2">${post.description}</p>
                </div>
            </div>
            <div class="border-t border-slate-100 px-4 py-3 flex items-center justify-between">
                <span class="text-xs font-bold text-brand-700">${post.priceHighlight || 'Sob consulta'}</span>
                <div class="flex space-x-1">
                    <button onclick="openDetailModal('${post.id}')" class="text-xs text-slate-600 hover:bg-slate-100 font-semibold py-1.5 px-2.5 rounded-lg">Ver</button>
                    <a href="${getWhatsAppLink(post)}" target="_blank" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm">WhatsApp</a>
                </div>
            </div>
        </article>
    `).join('');
}

// Redirecionamento Seguro WhatsApp (LGPD)
function getWhatsAppLink(post) {
    const cleanPhone = (post.phone || "").replace(/\D/g, '');
    const text = encodeURIComponent(`Olá ${post.author}! Vi seu post na Rede Vizinha sobre "${post.title}". Gostaria de mais informações.`);
    return `https://wa.me/55${cleanPhone}?text=${text}`;
}

// Navegação entre Abas Principais (Catálogo vs Mural)
function switchMainTab(tab) {
    const secCatalog = document.getElementById('sectionCatalog');
    const secRequests = document.getElementById('sectionRequests');
    const tabCatalog = document.getElementById('tabNavCatalog');
    const tabRequests = document.getElementById('tabNavRequests');

    if (tab === 'catalog') {
        secCatalog?.classList.remove('hidden');
        secRequests?.classList.add('hidden');
        if (tabCatalog) tabCatalog.className = "flex-1 py-2.5 text-center text-brand-700 border-b-2 border-brand-600 font-bold flex items-center justify-center space-x-1.5";
        if (tabRequests) tabRequests.className = "flex-1 py-2.5 text-center text-slate-500 border-b-2 border-transparent font-semibold flex items-center justify-center space-x-1.5";
    } else {
        secCatalog?.classList.add('hidden');
        secRequests?.classList.remove('hidden');
        if (tabRequests) tabRequests.className = "flex-1 py-2.5 text-center text-amber-700 border-b-2 border-amber-500 font-bold flex items-center justify-center space-x-1.5";
        if (tabCatalog) tabCatalog.className = "flex-1 py-2.5 text-center text-slate-500 border-b-2 border-transparent font-semibold flex items-center justify-center space-x-1.5";
        renderRequests();
    }
}

function renderRequests() {
    const list = document.getElementById('requestsList');
    const badge = document.getElementById('requestsCounterBadge');
    if (!list) return;
    if (badge) badge.innerText = requests.length;

    list.innerHTML = requests.map(req => `
        <div class="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
            <div class="flex items-start justify-between">
                <div>
                    <p class="text-xs font-bold text-slate-900">${req.author}</p>
                    <p class="text-[10px] text-slate-400">${req.createdAt} • <span class="font-semibold text-amber-700">${req.category}</span></p>
                </div>
                <button onclick="replyRequestPrompt('${req.id}')" class="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold px-3 py-1.5 rounded-xl">💬 Indicar Alguém</button>
            </div>
            <h4 class="font-black text-slate-900 text-sm sm:text-base">${req.title}</h4>
            ${req.details ? `<p class="text-xs text-slate-600">${req.details}</p>` : ''}
            <div class="border-t border-slate-100 pt-3 space-y-2">
                <p class="text-[11px] font-bold text-slate-400 uppercase">Respostas (${req.replies.length}):</p>
                ${req.replies.map(r => `<div class="bg-slate-50 p-2.5 rounded-2xl text-xs"><strong>${r.from}:</strong>${r.text}</div>`).join('')}
            </div>
        </div>
    `).join('');
}

// Funções de Gestão do Painel do Empreendedor (painel.html)
function initEntrepreneurPanel() {
    const myStore = posts.find(p => p.entrepreneurId === currentSession.userId);
    if (!myStore) {
        alert("Nenhum negócio associado a esta sessão.");
        return;
    }

    document.getElementById('loggedEntrepreneurName').innerText = `${myStore.author} (${myStore.location})`;
    document.getElementById('panelWelcomeTitle').innerText = `Olá, ${myStore.author}`;

    const totalItems = myStore.items.length;
    document.getElementById('productStatsBadge').innerText = `${totalItems} item(ns)`;
}

function openEditStoreModal() {
    const myStore = posts.find(p => p.entrepreneurId === currentSession.userId);
    if (!myStore) return;

    const newTitle = prompt("Novo Título da Vitrine:", myStore.title);
    if (newTitle === null) return;
    const newDesc = prompt("Nova Descrição:", myStore.description);
    if (newDesc === null) return;
    const newPhone = prompt("Novo WhatsApp (apenas números):", myStore.phone);
    if (newPhone === null) return;

    myStore.title = newTitle.trim() || myStore.title;
    myStore.description = newDesc.trim() || myStore.description;
    myStore.phone = newPhone.trim() || myStore.phone;

    saveToStorage();
    alert("Vitrine atualizada com sucesso!");
}

function openManageItemsModal() {
    const myStore = posts.find(p => p.entrepreneurId === currentSession.userId);
    if (!myStore) return;

    let itemsText = myStore.items.map(i => `${i.name} - ${i.price}`).join('\n');
    let updated = prompt("Edite os seus itens (Formato: Nome - Preço, um por linha):", itemsText);
    if (updated === null) return;

    let newItems = updated.split('\n').map(line => {
        let parts = line.split('-');
        return {
            name: parts[0]?.trim() || "Item",
            price: parts[1]?.trim() || "R$ 0,00",
            available: true
        };
    }).filter(i => i.name !== "");

    myStore.items = newItems;
    saveToStorage();
    alert("Itens atualizados com sucesso!");
    initEntrepreneurPanel();
}

// Utilitários de Toast
function showToast(msg) {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;
    document.getElementById('toastMessage').innerText = msg;
    toast.classList.remove('opacity-0', 'pointer-events-none');
    toast.classList.add('opacity-100');
    setTimeout(() => {
        toast.classList.remove('opacity-100');
        toast.classList.add('opacity-0', 'pointer-events-none');
    }, 3500);
}

/* ===================================================================== */
/* GESTÃO DE PERFIS E LOGIN SIMULADO (VERSÃO BLINDADA)                   */
/* ===================================================================== */

function openLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('hidden');
        updateLoginModalUI();
    } else {
        console.error("Modal de login não encontrado no HTML.");
    }
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function switchProfile(type) {
    if (type === 'morador') {
        currentSession.userType = 'morador';
        currentSession.userId = null;
        alert("Perfil alterado para: Morador");
        closeLoginModal();
        updateHeaderLabel();
    } else {
        currentSession.userType = 'empreendedor';
        currentSession.userId = 'ent_mariana';
        alert("Perfil alterado para: Morador Empreendedor!");
        closeLoginModal();
        // Redireciona para o painel do empreendedor
        window.location.href = 'painel.html';
    }
}

function updateHeaderLabel() {
    const btn = document.getElementById('headerProfileBtn');
    const label = document.getElementById('headerProfileLabel');
    const panelContainer = document.getElementById('entrepreneurPanelLinkContainer');
    
    if (!label || !btn) return;

    if (currentSession.userType === 'empreendedor') {
        label.innerText = "Perfil: Empreendedor";
        btn.className = "inline-flex items-center space-x-1.5 bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm";
        
        // Exibe o botão do painel no cabeçalho apenas para empreendedores
        if (panelContainer) {
            panelContainer.innerHTML = `
                <a href="painel.html" class="inline-flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition">
                    <span>Meu Painel</span>
                </a>
            `;
        }
    } else {
        label.innerText = "Perfil: Morador";
        btn.className = "inline-flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm";
        
        // Remove o botão do painel se for morador comum
        if (panelContainer) {
            panelContainer.innerHTML = "";
        }
    }
}

/* ===================================================================== */
/* SINCRONIZAÇÃO EM TEMPO REAL VIA LOCALSTORAGE                          */
/* ===================================================================== */

// Sincronizar dados do estado global com o localStorage
function saveToStorage() {
    localStorage.setItem('rv_posts', JSON.stringify(posts));
    localStorage.setItem('rv_requests', JSON.stringify(requests));
}

// Opcional: Ouve eventos de alteração caso o utilizador abra o painel e o catálogo em separadores diferentes
window.addEventListener('storage', (event) => {
    if (event.key === 'rv_posts') {
        posts = JSON.parse(event.newValue) || [];
        // Se estiver na página pública, atualiza a grelha automaticamente
        if (typeof renderPosts === 'function') {
            renderPosts();
        }
    }
});


/* ===================================================================== */
/* GESTÃO DE CADASTRO DE NOVO EMPREENDIMENTO                             */
/* ===================================================================== */

function openPublishModal() {
    document.getElementById('publishModal')?.classList.remove('hidden');
}

function closePublishModal() {
    document.getElementById('publishModal')?.classList.add('hidden');
}

function handleRegisterBusiness(event) {
    event.preventDefault();

    const author = document.getElementById('regAuthor').value.trim();
    const location = document.getElementById('regLocation').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const title = document.getElementById('regTitle').value.trim();
    const category = document.getElementById('regCategory').value;
    const priceHighlight = document.getElementById('regPrice').value.trim() || "Sob consulta";
    const coverImage = document.getElementById('regImage').value.trim() || "https://images.unsplash.com/photo-1556742049-0a67d553c2a5?w=800&auto=format&fit=crop&q=80";
    const description = document.getElementById('regDesc').value.trim();

    // Cria o novo objeto de negócio com ID único e vinculado a um entrepreneurId seguro
    const newStore = {
        id: "post_" + Date.now(),
        entrepreneurId: "ent_" + Math.random().toString(36.substring(2, 9)),
        author: author,
        location: location,
        phone: phone,
        instagram: "@" + author.toLowerCase().replace(/\s+/g, ''),
        title: title,
        category: category,
        coverImage: coverImage,
        priceHighlight: priceHighlight,
        description: description,
        rating: 5.0,
        indicationsCount: 1,
        items: [
            { name: "Serviço / Produto Principal", price: priceHighlight, available: true }
        ],
        testimonials: [{ author: "Condomínio Flex Osasco 2", text: "Novo empreendedor cadastrado!" }]
    };

    // Adiciona ao array global e grava no localStorage
    posts.unshift(newStore);
    saveToStorage();

    // Atualiza a sessão atual para este novo empreendedor para testar o painel imediatamente
    currentSession.userType = 'empreendedor';
    currentSession.userId = newStore.entrepreneurId;
    currentSession.name = author;
    saveToStorage();

    // Fecha o modal e limpa o formulário
    closePublishModal();
    document.getElementById('publishForm').reset();

    // Atualiza a grelha de anúncios públicos
    renderPosts();
    updateHeaderLabel();

    showToast("Negócio cadastrado com sucesso! Bem-vindo ao painel.");
}

/* ===================================================================== */
/* EXPORTAÇÃO GLOBAL DE FUNÇÕES PARA OS BOTÕES HTML (CORREÇÃO DE CLIQUE) */
/* ===================================================================== */

window.openLoginModal = function() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('hidden');
        updateLoginModalUI();
    } else {
        console.warn("Elemento #loginModal não encontrado nesta página.");
    }
};

window.closeLoginModal = function() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.add('hidden');
};

window.openPublishModal = function() {
    const modal = document.getElementById('publishModal');
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        console.warn("Elemento #publishModal não encontrado nesta página.");
    }
};

window.closePublishModal = function() {
    const modal = document.getElementById('publishModal');
    if (modal) modal.classList.add('hidden');
};

window.switchProfile = function(type) {
    if (type === 'morador') {
        currentSession.userType = 'morador';
        currentSession.userId = null;
        alert("Perfil alterado para: Morador");
        window.closeLoginModal();
        updateHeaderLabel();
    } else {
        currentSession.userType = 'empreendedor';
        currentSession.userId = 'ent_mariana';
        alert("Perfil alterado para: Morador Empreendedor!");
        window.closeLoginModal();
        window.location.href = 'painel.html';
    }
    saveToStorage();
};

// Inicialização automática ao carregar qualquer página do projeto
window.addEventListener('DOMContentLoaded', () => {
    updateHeaderLabel();
    
    // Inicializa as listagens se estivermos nas páginas públicas
    if (typeof initPublicApp === 'function') {
        initPublicApp();
    }
});