(() => {
  'use strict';

  const apiBase = String(window.REDE_VIZINHA_API_URL || '').replace(/\/+$/, '');
  const categories = ['Gastronomia', 'Manutenção e reformas', 'Beleza e bem-estar', 'Aulas e atividades', 'Pets', 'Moda e acessórios', 'Tecnologia e design', 'Outros serviços'];
  const state = { entrepreneurs: [], entrepreneursLoaded: false, entrepreneurLoadError: '', searchTimer: null, requestSequence: 0 };
  const $ = (id) => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function fold(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  async function apiRequest(path, options = {}) {
    if (!apiBase) throw new Error('A API não está configurada. Confira o endereço em config.js.');
    const headers = new Headers(options.headers || {});
    if (options.body && typeof options.body === 'string') headers.set('Content-Type', 'application/json');
    const response = await fetch(`${apiBase}${path}`, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a solicitação.');
    return payload;
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.setTimeout(() => toast.classList.remove('is-visible'), 3000);
  }

  function setBoardStatus(message, isError = false) {
    const status = $('boardStatus');
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function deduplicateEntrepreneurs(listings) {
    const byOwner = new Map();
    for (const listing of listings) {
      if (!listing.ownerId || !listing.ownerName) continue;
      const current = byOwner.get(listing.ownerId);
      if (!current || String(listing.title || '').localeCompare(current.businessName, 'pt-BR') < 0) {
        byOwner.set(listing.ownerId, { id: listing.ownerId, name: listing.ownerName, businessName: listing.title || 'Vitrine pública' });
      }
    }
    return [...byOwner.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async function loadEntrepreneurs() {
    try {
      const result = await apiRequest('/vitrines');
      state.entrepreneurs = deduplicateEntrepreneurs(result.listings || []);
      state.entrepreneursLoaded = true;
      state.entrepreneurLoadError = '';
    } catch (error) {
      state.entrepreneursLoaded = true;
      state.entrepreneurLoadError = error.message || 'Falha ao carregar os empreendedores.';
    }
    document.querySelectorAll('[data-mention-help]').forEach((element) => { element.textContent = mentionHelpText(); });
  }

  function mentionHelpText() {
    if (!state.entrepreneursLoaded) return 'Carregando empreendedores com vitrine pública aprovada…';
    if (state.entrepreneurLoadError) return 'Não foi possível carregar empreendedores agora. Você ainda pode publicar a indicação sem mencionar alguém.';
    return state.entrepreneurs.length
      ? 'Opcional: mencione aqui o profissional cadastrado que você está indicando. A menção ficará pública, sem notificação direta.'
      : 'Ainda não há empreendedores com vitrine pública aprovada para mencionar.';
  }

  function renderMentions(mentions = [], label = 'Profissional indicado') {
    if (!mentions.length) return '';
    return `<div class="indication-mentions"><span>${escapeHtml(label)}</span><div>${mentions.map((mention) => `<span class="mention-pill"><strong>${escapeHtml(mention.name)}</strong><small>${escapeHtml(mention.businessName || 'Empreendedor da comunidade')}</small></span>`).join('')}</div></div>`;
  }

  function renderReplies(replies = []) {
    const rows = replies.map((reply) => `<article class="indication-reply"><div class="reply-author"><strong>${escapeHtml(reply.author)}</strong>${reply.location ? `<span>${escapeHtml(reply.location)}</span>` : ''}<time>${escapeHtml(formatDate(reply.createdAt))}</time></div><p>${escapeHtml(reply.text)}</p>${renderMentions(reply.mentions || [])}</article>`).join('');
    return `<div class="indication-replies"><h3>Indicações da vizinhança <span>${replies.length}</span></h3>${rows || '<p class="reply-empty">Ainda não há respostas. Seja a primeira pessoa a ajudar.</p>'}</div>`;
  }

  function renderRequest(request) {
    const status = request.status === 'encerrada' ? 'Pedido encerrado' : 'Pedido aberto';
    return `<article class="indication-card">
      <div class="indication-card-meta"><span class="indication-category">${escapeHtml(request.category)}</span><span class="indication-open">${escapeHtml(status)}</span><time>${escapeHtml(formatDate(request.createdAt))}</time></div>
      <h2>${escapeHtml(request.title)}</h2>
      ${request.details ? `<p class="indication-details">${escapeHtml(request.details)}</p>` : ''}
      <p class="indication-author">Pedido por <strong>${escapeHtml(request.author)}</strong>${request.location ? ` <span>· ${escapeHtml(request.location)}</span>` : ''}</p>
      ${renderReplies(request.replies || [])}
      ${request.status === 'encerrada' ? '' : `<details class="reply-composer"><summary>Compartilhar uma indicação</summary><form class="reply-form" data-reply-form data-request-id="${escapeHtml(request.id)}"><div class="reply-fields"><div class="form-row"><label>Seu nome</label><input name="author" required minlength="2" maxlength="120" autocomplete="name" placeholder="Seu nome"></div><div class="form-row"><label>Torre/unidade <span>· opcional</span></label><input name="location" maxlength="100" placeholder="Ex.: Torre 2"></div></div><div class="form-row"><label>Sua indicação</label><textarea name="text" required minlength="3" maxlength="1000" rows="3" placeholder="Conte sua experiência e indique o profissional que recomenda."></textarea></div><div class="form-row mention-field"><label>Empreendedor indicado <span>· opcional, até 5</span></label><div class="mention-input-wrap"><input type="search" data-mention-search autocomplete="off" placeholder="Busque pelo nome ou negócio" aria-expanded="false"><div class="mention-suggestions" data-mention-suggestions role="listbox" hidden></div></div><div class="selected-mentions" data-selected-mentions></div><small class="image-help" data-mention-help>${escapeHtml(mentionHelpText())}</small></div><p class="form-feedback" data-reply-feedback role="alert" aria-live="polite"></p><button class="button button-dark button-small" type="submit">Publicar indicação</button></form></details>`}
    </article>`;
  }

  async function loadRequests() {
    const sequence = ++state.requestSequence;
    const query = $('indicationSearch').value.trim();
    const category = $('indicationCategory').value;
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category && category !== 'Todas') params.set('category', category);
    setBoardStatus('Carregando indicações…');
    $('emptyState').hidden = true;
    try {
      const queryString = params.toString();
      const result = await apiRequest(`/indicacoes${queryString ? `?${queryString}` : ''}`);
      if (sequence !== state.requestSequence) return;
      const requests = result.requests || [];
      $('requestCount').textContent = `${requests.length} ${requests.length === 1 ? 'pedido' : 'pedidos'}`;
      $('requestsList').innerHTML = requests.map(renderRequest).join('');
      $('emptyState').hidden = requests.length !== 0;
      setBoardStatus(requests.length ? '' : 'Nenhum resultado para estes filtros.');
    } catch (error) {
      if (sequence !== state.requestSequence) return;
      $('requestCount').textContent = 'Indisponível';
      $('requestsList').innerHTML = '';
      $('emptyState').hidden = true;
      setBoardStatus(`${error.message} Se as tabelas ainda não existem, entre na pasta backend e execute npm.cmd run db:migrate.`, true);
    }
  }

  function selectedMentionsFor(form) {
    if (!Array.isArray(form._selectedMentions)) form._selectedMentions = [];
    return form._selectedMentions;
  }

  function renderSelectedMentions(form) {
    form.querySelector('[data-selected-mentions]').innerHTML = selectedMentionsFor(form).map((person) => `<span class="selected-mention"><span>${escapeHtml(person.name)} · ${escapeHtml(person.businessName)}</span><button type="button" data-remove-mention="${escapeHtml(person.id)}" aria-label="Remover indicação de ${escapeHtml(person.name)}">×</button></span>`).join('');
  }

  function renderMentionSuggestions(form, query) {
    const input = form.querySelector('[data-mention-search]');
    const container = form.querySelector('[data-mention-suggestions]');
    const normalized = fold(query);
    if (normalized.length < 2) {
      container.innerHTML = '';
      container.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      return;
    }
    const selected = new Set(selectedMentionsFor(form).map((person) => person.id));
    const matches = state.entrepreneurs.filter((person) => !selected.has(person.id) && fold(`${person.name} ${person.businessName}`).includes(normalized)).slice(0, 8);
    container.innerHTML = matches.length
      ? matches.map((person) => `<button class="mention-suggestion" type="button" role="option" data-add-mention="${escapeHtml(person.id)}"><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.businessName)}</span></button>`).join('')
      : '<p class="mention-no-result">Nenhum empreendedor encontrado com esse nome.</p>';
    container.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function resetRequestForm() {
    $('requestForm').reset();
    $('requestFeedback').textContent = '';
    $('requestFeedback').classList.remove('is-success');
  }

  async function submitRequest(event) {
    event.preventDefault();
    const form = $('requestForm');
    if (!form.reportValidity()) return;
    const payload = {
      author: $('requestAuthor').value.trim(),
      location: $('requestLocation').value.trim(),
      category: $('requestCategory').value,
      title: $('requestTitle').value.trim(),
      details: $('requestDetails').value.trim()
    };
    const publicCopy = `Publicar este pedido no mural da comunidade?\n\nNome: ${payload.author}\nTorre/unidade: ${payload.location || 'não informada'}\nCategoria: ${payload.category}\nPedido: ${payload.title}\nDetalhes: ${payload.details || 'não informados'}`;
    if (!window.confirm(publicCopy)) return;
    const button = $('submitRequestButton');
    button.disabled = true;
    $('requestFeedback').textContent = '';
    try {
      await apiRequest('/indicacoes', { method: 'POST', body: JSON.stringify(payload) });
      $('requestDialog').close();
      resetRequestForm();
      await loadRequests();
      showToast('Pedido publicado no mural.');
    } catch (error) {
      $('requestFeedback').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }

  async function submitReply(event) {
    event.preventDefault();
    const form = event.target.closest('[data-reply-form]');
    if (!form || !form.reportValidity()) return;
    const data = new FormData(form);
    const selectedMentions = selectedMentionsFor(form);
    const payload = {
      author: String(data.get('author') || '').trim(),
      location: String(data.get('location') || '').trim(),
      text: String(data.get('text') || '').trim(),
      mentionedEntrepreneurIds: selectedMentions.map((person) => person.id)
    };
    const mentionNames = selectedMentions.map((person) => `${person.name} (${person.businessName})`).join(', ') || 'nenhum';
    if (!window.confirm(`Publicar esta indicação no mural?\n\nNome: ${payload.author}\nTorre/unidade: ${payload.location || 'não informada'}\nIndicação: ${payload.text}\nEmpreendedores indicados: ${mentionNames}`)) return;
    const button = form.querySelector('button[type="submit"]');
    const feedback = form.querySelector('[data-reply-feedback]');
    button.disabled = true;
    feedback.textContent = '';
    try {
      await apiRequest(`/indicacoes/${encodeURIComponent(form.dataset.requestId)}/respostas`, { method: 'POST', body: JSON.stringify(payload) });
      await loadRequests();
      showToast('Sua indicação foi publicada.');
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }

  function bindEvents() {
    $('openRequestButton').addEventListener('click', () => $('requestDialog').showModal());
    $('emptyRequestButton').addEventListener('click', () => $('requestDialog').showModal());
    $('closeRequestButton').addEventListener('click', () => $('requestDialog').close());
    $('cancelRequestButton').addEventListener('click', () => $('requestDialog').close());
    $('requestDialog').addEventListener('close', resetRequestForm);
    $('requestForm').addEventListener('submit', submitRequest);
    $('requestsList').addEventListener('submit', submitReply);
    $('requestsList').addEventListener('input', (event) => {
      const input = event.target.closest('[data-mention-search]');
      if (input) renderMentionSuggestions(input.closest('[data-reply-form]'), input.value);
    });
    $('requestsList').addEventListener('click', (event) => {
      const addButton = event.target.closest('[data-add-mention]');
      const removeButton = event.target.closest('[data-remove-mention]');
      if (!addButton && !removeButton) return;
      const form = event.target.closest('[data-reply-form]');
      if (!form) return;
      const selected = selectedMentionsFor(form);
      if (addButton) {
        if (selected.length >= 5) { showToast('Você pode indicar até 5 empreendedores por resposta.'); return; }
        const person = state.entrepreneurs.find((item) => item.id === addButton.dataset.addMention);
        if (!person || selected.some((item) => item.id === person.id)) return;
        selected.push(person);
      } else {
        form._selectedMentions = selected.filter((item) => item.id !== removeButton.dataset.removeMention);
      }
      renderSelectedMentions(form);
      const input = form.querySelector('[data-mention-search]');
      if (addButton) input.value = '';
      renderMentionSuggestions(form, input.value);
      input.focus();
    });

    $('indicationSearch').addEventListener('input', () => {
      window.clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(loadRequests, 250);
    });
    $('indicationCategory').addEventListener('change', loadRequests);

  }

  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadEntrepreneurs();
    loadRequests();
  });
})();
