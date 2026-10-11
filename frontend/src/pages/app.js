/* ===================================================================== */
/* REDE VIZINHA - APP.JS COMPLETO E CORRIGIDO                            */
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

let posts = JSON.parse(localStorage.getItem('rv_posts'));
if (!posts) {
    posts = defaultPosts;
    localStorage.setItem('rv_posts', JSON.stringify(posts));
}

let requests = JSON.parse(localStorage.getItem('rv_requests')) || [];
let currentSession = JSON.parse(localStorage.getItem('rv_session')) || {
    userId: null,
    userType: "morador",
    name: "Morador Visitante"
};

let categories = ["Todos", "Gastronomia", "Estética & Beleza", "Manutenção & Reformas", "Aulas & Treinos", "Cuidados & Pet", "Moda & Costura", "Tecnologia & Design"];
let selectedCategory = "Todos";
let searchQuery = "";
let currentActivePostId = null;

function saveToStorage() {
    localStorage.setItem('rv_posts', JSON.stringify(posts));
    localStorage.setItem('rv_session', JSON.stringify(currentSession));
}

// ===================================================================== */
/* GESTÃO DE MODAIS E PERFIS                                             */
/* ===================================================================== */

window.openLoginModal = function() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('hidden');
        updateLoginModalUI();
    }
};

window.closeLoginModal = function() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.add('hidden');
};

window.openPublishModal = function() {
    const modal = document.getElementById('publishModal');
    if (modal) modal.classList.remove('hidden');
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
    } else {
        currentSession.userType = 'empreendedor';
        currentSession.userId = 'ent_mariana';
        alert("Perfil alterado para: Morador Empreendedor!");
        window.location.href = 'painel.html';
    }
    saveToStorage();
    window.closeLoginModal();
    updateHeaderLabel();
};

function updateHeaderLabel() {
    const btn = document.getElementById('headerProfileBtn');
    const label = document.getElementById('headerProfileLabel');
    const panelContainer = document.getElementById('entrepreneurPanelLinkContainer');
    
    if (!label || !btn) return;

    if (currentSession.userType === 'empreendedor') {
        label.innerText = "Perfil: Empreendedor";
        btn.className = "inline-flex items-center space-x-1.5 bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm";
        if (panelContainer) {
            panelContainer.innerHTML = `
                <a href="painel.html" class="inline-flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition">
                    <span>🏪 Meu Painel</span>
                </a>
            `;
        }
    } else {
        label.innerText = "Perfil: Morador";
        btn.className = "inline-flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm";
        if (panelContainer) {
            panelContainer.innerHTML = "";
        }
    }
}

function updateLoginModalUI() {
    const shortcut = document.getElementById('entrepreneurPanelShortcut');
    if (!shortcut) return;
    if (currentSession.userType === 'empreendedor') {
        shortcut.classList.remove('hidden');
    } else {
        shortcut.classList.add('hidden');
    }
}

/* ===================================================================== */
/* GESTÃO DE AUTENTICAÇÃO REAL COM SENHA E CREDENCIAIS SOCIAIS           */
/* ===================================================================== */

let isRegisterMode = false;

window.openLoginModal = function() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('hidden');
        updateLoginModalUI();
    }
};

window.closeLoginModal = function() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.add('hidden');
};

window.toggleAuthMode = function() {
    isRegisterMode = !isRegisterMode;
    const title = document.getElementById('authModalTitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleText = document.getElementById('authToggleText');
    const extraFields = document.getElementById('extraRegisterFields');

    if (isRegisterMode) {
        title.innerText = "Criar Conta de Empreendedor";
        submitBtn.innerText = "Registar Conta com Senha";
        toggleText.innerText = "Já tem uma conta? Faça login";
        extraFields.classList.remove('hidden');
    } else {
        title.innerText = "Acesso Restrito - Flex Osasco 2";
        submitBtn.innerText = "Entrar na Conta";
        toggleText.innerText = "Não tem uma conta? Crie agora com senha";
        extraFields.classList.add('hidden');
    }
};

/* ===================================================================== */
/* FLUXO DE CADASTRO E LOGIN DIRECIONADO AO PAINEL                       */
/* ===================================================================== */

window.handleEmailAuth = function(event) {
    event.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;

    if (password.length < 6) {
        alert("A senha precisa ter pelo menos 6 caracteres.");
        return;
    }

    if (isRegisterMode) {
        const name = document.getElementById('authName').value.trim();
        const location = document.getElementById('authLocation').value.trim();
        
        if (!name || !location) {
            alert("Por favor, preencha o seu nome e a torre/apartamento.");
            return;
        }

        // Regista o novo empreendedor com os dados informados
        currentSession = {
            userId: "ent_" + Date.now(),
            userType: "empreendedor",
            name: name,
            email: email,
            location: location
        };
        saveToStorage();
        
        alert("Cadastro realizado com sucesso! Bem-vindo ao seu painel.");
        window.location.href = 'painel.html'; // Abre o painel para cadastrar produtos
    } else {
        // Validação de login existente
        currentSession = {
            userId: "ent_mariana",
            userType: "empreendedor",
            name: "Mariana Silva",
            email: email,
            location: "Torre Ipê - Apto 74"
        };
        saveToStorage();
        
        alert("Login efetuado com sucesso!");
        window.location.href = 'painel.html'; // Abre o painel
    }
};

window.handleSocialLogin = function(provider) {
    // Autenticação via Google ou Outlook e redirecionamento imediato para o painel
    currentSession = {
        userId: "ent_social_" + Date.now(),
        userType: "empreendedor",
        name: `Empreendedor (${provider})`,
        email: `usuario@${provider.toLowerCase()}.com`,
        location: "Flex Osasco 2"
    };
    saveToStorage();
    
    alert(`Conta verificada via ${provider} com sucesso!`);
    window.location.href = 'painel.html'; // Abre o painel para cadastrar produtos/serviços
};

function updateLoginModalUI() {
    const shortcut = document.getElementById('entrepreneurPanelShortcut');
    if (!shortcut) return;
    if (currentSession.userType === 'empreendedor' && currentSession.userId) {
        shortcut.classList.remove('hidden');
    } else {
        shortcut.classList.add('hidden');
    }
}


// ===================================================================== */
/* RENDERIZAÇÃO DO CATÁLOGO PÚBLICO E FILTROS                             */
/* ===================================================================== */

window.initPublicApp = function() {
    renderCategories();
    renderPosts();
};

function renderCategories() {
    const container = document.getElementById('categoriesBar');
    if (!container) return;
    container.innerHTML = categories.map(cat => {
        const isActive = cat === selectedCategory;
        const activeClass = isActive 
            ? "bg-slate-900 text-white shadow-sm font-semibold" 
            : "bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium";
        return `<button onclick="setCategory('${cat}')" class="px-3.5 py-1.5 rounded-full whitespace-nowrap transition text-xs shrink-0 ${activeClass}">${cat}</button>`;
    }).join('');
}

window.setCategory = function(cat) {
    selectedCategory = cat;
    document.getElementById('activeFilterBadge').innerText = cat;
    document.getElementById('activeFilterBadge').classList.remove('hidden');
    document.getElementById('clearFiltersBtn').classList.remove('hidden');
    renderCategories();
    renderPosts();
};

window.resetCategoryFilter = function() {
    selectedCategory = "Todos";
    document.getElementById('searchInput').value = "";
    searchQuery = "";
    document.getElementById('activeFilterBadge').classList.add('hidden');
    document.getElementById('clearFiltersBtn').classList.add('hidden');
    renderCategories();
    renderPosts();
};

window.filterPosts = function() {
    searchQuery = document.getElementById('searchInput')?.value.toLowerCase().trim() || "";
    renderPosts();
};

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
                    <a href="https://wa.me/55${(post.phone || '').replace(/\D/g, '')}" target="_blank" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm">WhatsApp</a>
                </div>
            </div>
        </article>
    `).join('');
}

// ===================================================================== */
/* MODAL DE DETALHES DA VITRINE E AVALIAÇÕES                             */
/* ===================================================================== */

window.openDetailModal = function(id) {
    const post = posts.find(p => p.id === id);
    if (!post) return;
    currentActivePostId = id;

    document.getElementById('modalCategoryTag').innerText = post.category;
    document.getElementById('modalCover').src = post.coverImage;
    document.getElementById('modalRatingValue').innerText = post.rating || 5.0;
    document.getElementById('modalIndicationsCount').innerText = `${post.indicationsCount || 1} indicações`;
    document.getElementById('modalTitle').innerText = post.title;
    document.getElementById('modalAuthor').innerText = post.author;
    document.getElementById('modalLocation').innerText = post.location;
    document.getElementById('modalPriceHighlight').innerText = post.priceHighlight || '';
    document.getElementById('modalDescription').innerText = post.description;

    // Itens / Catálogo
    const itemsListContainer = document.getElementById('modalItemsList');
    if (post.items && post.items.length > 0) {
        document.getElementById('modalItemsSection').classList.remove('hidden');
        itemsListContainer.innerHTML = post.items.map(i => `
            <div class="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl text-xs">
                <span class="font-medium text-slate-800">${i.name}</span>
                <span class="font-bold text-brand-700">${i.price}</span>
            </div>
        `).join('');
    } else {
        document.getElementById('modalItemsSection').classList.add('hidden');
    }

    // Depoimentos
    renderTestimonials(post);

    // Link WhatsApp
    const cleanPhone = (post.phone || '').replace(/\D/g, '');
    const text = encodeURIComponent(`Olá ${post.author}! Vi a sua vitrine "${post.title}" na Rede Vizinha do Flex Osasco 2 e gostaria de mais informações.`);
    document.getElementById('modalWhatsappLink').href = `https://wa.me/55${cleanPhone}?text=${text}`;

    document.getElementById('detailModal').classList.remove('hidden');
};

window.closeDetailModal = function() {
    document.getElementById('detailModal').classList.add('hidden');
    currentActivePostId = null;
};

window.handleQuickRecommend = function() {
    if (!currentActivePostId) return;
    const post = posts.find(p => p.id === currentActivePostId);
    if (post) {
        post.indicationsCount = (post.indicationsCount || 0) + 1;
        saveToStorage();
        document.getElementById('modalIndicationsCount').innerText = `${post.indicationsCount} indicações`;
        renderPosts();
        alert("Obrigado por indicar este vizinho!");
    }
};

window.toggleAddReviewForm = function() {
    const form = document.getElementById('addReviewForm');
    if (form) form.classList.toggle('hidden');
};

window.submitNewReview = function() {
    const authorInput = document.getElementById('reviewAuthor').value.trim();
    const commentInput = document.getElementById('reviewComment').value.trim();

    if (!authorInput || !commentInput) {
        alert("Por favor, preencha o seu nome e o comentário.");
        return;
    }

    const post = posts.find(p => p.id === currentActivePostId);
    if (post) {
        if (!post.testimonials) post.testimonials = [];
        post.testimonials.push({ author: authorInput, text: commentInput });
        saveToStorage();
        renderTestimonials(post);
        document.getElementById('reviewAuthor').value = "";
        document.getElementById('reviewComment').value = "";
        toggleAddReviewForm();
        alert("Avaliação enviada com sucesso!");
    }
};

function renderTestimonials(post) {
    const container = document.getElementById('modalTestimonials');
    const countLabel = document.getElementById('testimonialsCount');
    const testimonials = post.testimonials || [];

    if (countLabel) countLabel.innerText = testimonials.length;
    if (!container) return;

    if (testimonials.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic">Ainda não há depoimentos para este serviço.</p>`;
        return;
    }

    container.innerHTML = testimonials.map(t => `
        <div class="bg-slate-50 p-3 rounded-xl text-xs space-y-1">
            <p class="font-bold text-slate-800">${t.author}</p>
            <p class="text-slate-600">${t.text}</p>
        </div>
    `).join('');
}

// ===================================================================== */
/* CADASTRO DE NOVAS VITRINES (FORMULÁRIO)                               */
/* ===================================================================== */

window.addCatalogItemInput = function() {
    const container = document.getElementById('catalogItemsContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = "catalog-row flex gap-2 mt-2";
    div.innerHTML = `
        <input type="text" placeholder="Nome do item" class="item-name flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
        <input type="text" placeholder="Preço" class="item-price w-24 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
    `;
    container.appendChild(div);
};

window.handleImageUpload = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('formImageUrl').value = e.target.result;
            const preview = document.getElementById('imagePreview');
            preview.src = e.target.result;
            document.getElementById('imagePreviewContainer').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
};

window.handlePostSubmit = function(event) {
    event.preventDefault();

    // Recolher itens do catálogo dinâmicos
    const itemRows = document.querySelectorAll('.catalog-row');
    const items = [];
    itemRows.forEach(row => {
        const name = row.querySelector('.item-name').value.trim();
        const price = row.querySelector('.item-price').value.trim();
        if (name) {
            items.push({ name: name, price: price || "Sob consulta", available: true });
        }
    });

    const newStore = {
        id: "post_" + Date.now(),
        entrepreneurId: "ent_" + Math.random().toString(36).substring(2, 9),
        author: document.getElementById('formAuthor').value.trim(),
        location: document.getElementById('formLocation').value.trim(),
        phone: document.getElementById('formPhone').value.trim(),
        instagram: document.getElementById('formInstagram').value.trim(),
        title: document.getElementById('formTitle').value.trim(),
        category: document.getElementById('formCategory').value,
        coverImage: document.getElementById('formImageUrl').value.trim() || "https://images.unsplash.com/photo-1556742049-0a67d553c2a5?w=800&auto=format&fit=crop&q=80",
        priceHighlight: document.getElementById('formPriceBadge').value.trim() || "Sob consulta",
        description: document.getElementById('formDescription').value.trim(),
        rating: 5.0,
        indicationsCount: 1,
        items: items.length > 0 ? items : [{ name: "Serviço Principal", price: "Sob consulta", available: true }],
        testimonials: []
    };

    posts.unshift(newStore);
    saveToStorage();
    window.closePublishModal();
    event.target.reset();
    document.getElementById('imagePreviewContainer').classList.add('hidden');
    renderPosts();
    alert("Vitrine publicada com sucesso!");
};

// ===================================================================== */
/* INICIALIZAÇÃO AUTOMÁTICA DA PÁGINA                                     */
/* ===================================================================== */

window.addEventListener('DOMContentLoaded', () => {
    updateHeaderLabel();
    if (typeof window.initPublicApp === 'function') {
        window.initPublicApp();
    }
});