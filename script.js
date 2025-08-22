// ====== Config ======
const GRID = document.getElementById('grid')
const LOADER = document.getElementById('loader')
const EMPTY = document.getElementById('empty')
const SEARCH = document.getElementById('search')
const TYPE_FILTER = document.getElementById('type-filter')
const BTN_CLEAR = document.getElementById('btn-clear')
const BTN_LOAD = document.getElementById('btn-load')
const BTN_THEME = document.getElementById('btn-theme')
const BTN_FAVS = document.getElementById('btn-favs')
const BTN_SHINY = document.getElementById('btn-shiny')

const MODAL = document.getElementById('modal')
const MODAL_IMG = document.getElementById('modal-art')
const MODAL_TITLE = document.getElementById('modal-title')
const MODAL_TYPES = document.getElementById('modal-types')
const MODAL_HEIGHT = document.getElementById('modal-height')
const MODAL_WEIGHT = document.getElementById('modal-weight')
const MODAL_ABIL = document.getElementById('modal-abilities')
const MODAL_STATS = document.getElementById('modal-stats')
const MODAL_CRY = document.getElementById('modal-cry')

const PAGE_SIZE = 24
const MAX_ID = 1010  // limite seguro da PokeAPI
let loadedMax = 0
let shinyMode = false
let showFavsOnly = false
let cache = new Map()       // id -> pokemon data
let favs = new Set(JSON.parse(localStorage.getItem('favs') || '[]'))

// background por tipo
const TYPE_BG = {
    normal: '#F5F5F5', fire: '#FDDFDF', water: '#DEF3FD', electric: '#FCF7DE',
    grass: '#DEFDE0', ice: '#E0F7FA', fighting: '#E6E0D4', poison: '#E5D4F5',
    ground: '#F4E7DA', flying: '#F5F5F5', psychic: '#EAEDA1', bug: '#F8D5A3',
    rock: '#D5D5D4', ghost: '#E8E8FF', dragon: '#97B3E6', dark: '#DDD6FE',
    steel: '#E2E8F0', fairy: '#FCEAFF'
}

// ====== Helpers ======
const pad = n => String(n).padStart(3, '0')
const cap = s => s[0].toUpperCase() + s.slice(1)
const artOf = p => {
    const other = p.sprites?.other || {}
    const dream = other['dream_world']?.front_default
    const off = other['official-artwork']?.front_default
    const front = p.sprites?.front_default
    return shinyMode
        ? (other['official-artwork']?.front_shiny || p.sprites?.front_shiny || off || front)
        : (dream || off || front)
}
const typesOf = p => p.types.map(t => t.type.name)
const matchesType = (p, type) => !type || typesOf(p).includes(type)

// ====== UI State ======
function setLoading(on) {
    LOADER.classList.toggle('hidden', !on)
    LOADER.classList.toggle('flex', on)
}
function saveFavs() {
    localStorage.setItem('favs', JSON.stringify(Array.from(favs)))
}
function setThemeToggle() {
    const root = document.documentElement
    const dark = root.classList.toggle('dark')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
}

// ====== Fetch ======
async function fetchPokemon(id) {
    if (cache.has(id)) return cache.get(id)
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
    if (!res.ok) throw new Error('Falha ao buscar Pokémon: ' + id)
    const data = await res.json()
    cache.set(id, data)
    return data
}

async function loadNextPage() {
    if (loadedMax >= MAX_ID) return
    setLoading(true)
    const from = loadedMax + 1
    const to = Math.min(loadedMax + PAGE_SIZE, MAX_ID)
    const promises = []
    for (let i = from; i <= to; i++) promises.push(fetchPokemon(i))
    const pokes = await Promise.all(promises)
    loadedMax = to
    pokes.forEach(renderCard)
    setLoading(false)
    applyFilters()
}

// ====== Render ======
function renderCard(p) {
    // evita duplicar
    if (document.getElementById('poke-' + p.id)) return

    const type = typesOf(p)[0]
    const card = document.createElement('button')
    card.id = 'poke-' + p.id
    card.className = `
    group rounded-2xl p-5 text-left shadow-card transition hover:-translate-y-1 hover:shadow-xl
    bg-white/90 dark:bg-zinc-800/80
  `
    card.dataset.name = p.name
    card.dataset.id = p.id
    card.dataset.types = typesOf(p).join(',')

    card.innerHTML = `
    <div class="flex items-start justify-between">
      <span class="text-xs px-3 py-1 rounded-full bg-black/10 dark:bg-white/10">#${pad(p.id)}</span>
      <button class="fav text-xl" title="Favoritar">${favs.has(p.id) ? '⭐' : '☆'}</button>
    </div>
    <div class="w-32 h-32 mx-auto my-3 rounded-full flex items-center justify-center"
         style="background:${TYPE_BG[type] || '#eee'}">
      <img class="max-w-[85%] max-h-[85%] object-contain" alt="${p.name}" src="${artOf(p)}">
    </div>
    <h3 class="text-lg font-semibold">${cap(p.name)}</h3>
    <div class="text-sm opacity-70 capitalize">Tipo: ${typesOf(p).join(', ')}</div>
  `

    // abrir modal
    card.addEventListener('click', (e) => {
        // se clicou na estrela, não abre modal
        if (e.target && e.target.classList.contains('fav')) return
        openModal(p)
        // tenta tocar cry (se a PokeAPI fornecer)
        tryPlayCry(p)
    })

    // favoritar
    card.querySelector('.fav').addEventListener('click', (e) => {
        e.stopPropagation()
        if (favs.has(p.id)) { favs.delete(p.id); e.target.textContent = '☆' }
        else { favs.add(p.id); e.target.textContent = '⭐' }
        saveFavs()
        if (showFavsOnly) applyFilters()
    })

    GRID.appendChild(card)
}

// ====== Modal ======
function statBar(label, value) {
    const pct = Math.min(100, Math.round((value / 200) * 100))
    return `
    <div>
      <div class="flex justify-between text-sm">
        <span>${label}</span><span class="opacity-70">${value}</span>
      </div>
      <div class="h-2 rounded bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
        <div class="h-full bg-indigo-500" style="width:${pct}%"></div>
      </div>
    </div>
  `
}

function openModal(p) {
    MODAL_IMG.src = artOf(p)
    MODAL_TITLE.textContent = `#${pad(p.id)} · ${cap(p.name)}`
    MODAL_TYPES.innerHTML = `<span class="opacity-70">Tipos:</span> <b class="capitalize">${typesOf(p).join(', ')}</b>`
    MODAL_HEIGHT.textContent = `${(p.height / 10).toFixed(1)} m`
    MODAL_WEIGHT.textContent = `${(p.weight / 10).toFixed(1)} kg`
    MODAL_ABIL.innerHTML = p.abilities.map(a => cap(a.ability.name)).join(', ')
    MODAL_STATS.innerHTML = p.stats.map(s => statBar(cap(s.stat.name), s.base_stat)).join('')
    MODAL.classList.remove('hidden')
    MODAL.classList.add('flex')

    // fechar
    MODAL.querySelectorAll('[data-close]').forEach(el => el.onclick = closeModal)
}
function closeModal() {
    MODAL.classList.add('hidden')
    MODAL.classList.remove('flex')
}

// ====== Cry (best effort; ignora se não houver campo) ======
function tryPlayCry(p) {
    const url = p.cries?.latest || p.cries?.legacy
    if (!url) return
    MODAL_CRY.src = url
    MODAL_CRY.play().catch(() => {/*silencia erro de autoplay*/ })
}

// ====== Filtros / Busca ======
function applyFilters() {
    const q = (SEARCH.value || '').trim().toLowerCase()
    const t = TYPE_FILTER.value
    let visible = 0

    const cards = Array.from(GRID.children)
    cards.forEach(card => {
        const name = card.dataset.name
        const id = card.dataset.id
        const types = card.dataset.types.split(',')
        const isFav = favs.has(parseInt(id, 10))

        const passText = !q || name.includes(q) || pad(id).includes(q) || id === q
        const passType = !t || types.includes(t)
        const passFavs = !showFavsOnly || isFav

        const show = passText && passType && passFavs
        card.classList.toggle('hidden', !show)
        if (show) visible++
    })

    EMPTY.classList.toggle('hidden', visible !== 0)
}

SEARCH.addEventListener('input', applyFilters)
TYPE_FILTER.addEventListener('change', applyFilters)
BTN_CLEAR.addEventListener('click', () => {
    SEARCH.value = ''
    TYPE_FILTER.value = ''
    showFavsOnly = false
    BTN_FAVS.classList.remove('ring', 'ring-amber-400')
    applyFilters()
})

BTN_LOAD.addEventListener('click', loadNextPage)
BTN_THEME.addEventListener('click', setThemeToggle)
BTN_FAVS.addEventListener('click', () => {
    showFavsOnly = !showFavsOnly
    BTN_FAVS.classList.toggle('ring', showFavsOnly)
    BTN_FAVS.classList.toggle('ring-amber-400', showFavsOnly)
    applyFilters()
})
BTN_SHINY.addEventListener('click', () => {
    shinyMode = !shinyMode
    // re-renderizar apenas imagens (sem refazer cards)
    Array.from(GRID.children).forEach(card => {
        const id = parseInt(card.dataset.id, 10)
        const p = cache.get(id)
        if (!p) return
        const img = card.querySelector('img')
        img.src = artOf(p)
    })
    // se modal aberto, atualiza
    if (!MODAL.classList.contains('hidden')) {
        const idOpen = MODAL_TITLE.textContent.match(/#(\d+)/)?.[1]
        if (idOpen) {
            const p = cache.get(parseInt(idOpen, 10))
            if (p) MODAL_IMG.src = artOf(p)
        }
    }
})

// Fechar modal com overlay ou X
MODAL.addEventListener('click', (e) => { if (e.target.dataset.close !== undefined) closeModal() })
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal() })

    // ====== Boot ======
    ; (async function init() {
        setLoading(true)
        // carrega a primeira página
        await loadNextPage()
        setLoading(false)
        applyFilters()
    })()
