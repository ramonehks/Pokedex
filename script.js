const WALLPAPER_URL = "https://images8.alphacoders.com/136/1360352.png" // wallpaper

document.body.style.backgroundImage = `url(${WALLPAPER_URL})`

const GRID = document.getElementById('grid')
const LOADER = document.getElementById('loader')
const EMPTY = document.getElementById('empty')
const SEARCH = document.getElementById('search')
const TYPE_FILTER = document.getElementById('type-filter')
const BTN_CLEAR = document.getElementById('btn-clear')
const BTN_LOAD = document.getElementById('btn-load')
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

const PAGE_SIZE = 24
const MAX_ID = 300
let loadedMax = 0
let shinyMode = false
let showFavsOnly = false
let cache = new Map()
let favs = new Set(JSON.parse(localStorage.getItem('favs') || '[]'))

const pad = n => String(n).padStart(3,'0')
const cap = s => s[0].toUpperCase() + s.slice(1)

const artOf = p => {
  const other = p.sprites?.other?.['official-artwork'] || {}
  return shinyMode ? other.front_shiny : other.front_default
}

const typesOf = p => p.types.map(t => t.type.name)

function setLoading(on){ LOADER.classList.toggle('hidden', !on); LOADER.classList.toggle('flex', on) }
function saveFavs(){ localStorage.setItem('favs', JSON.stringify([...favs])) }

async function fetchPokemon(id){
  if (cache.has(id)) return cache.get(id)
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
  const data = await res.json()
  cache.set(id,data)
  return data
}

async function loadNextPage(){
  if (loadedMax >= MAX_ID) return
  setLoading(true)
  const from = loadedMax+1, to = Math.min(loadedMax+PAGE_SIZE, MAX_ID)
  const pokes = await Promise.all(Array.from({length:to-from+1},(_,i)=>fetchPokemon(from+i)))
  loadedMax = to
  pokes.forEach(renderCard)
  setLoading(false)
  applyFilters()
}

function renderCard(p){
  if (document.getElementById('poke-'+p.id)) return
  const card = document.createElement('button')
  card.id = 'poke-'+p.id
  card.className = "pokemon-card w-full text-left"
  card.dataset.name = p.name
  card.dataset.id = p.id
  card.dataset.types = typesOf(p).join(',')

  card.innerHTML = `
    <div class="flex items-start justify-between">
      <span class="text-xs px-3 py-1 rounded-full bg-cyan-500/40">#${pad(p.id)}</span>
      <button class="fav text-xl">${favs.has(p.id) ? '⭐' : '☆'}</button>
    </div>
    <div class="w-32 h-32 mx-auto my-3 rounded-full flex items-center justify-center bg-white/30 backdrop-blur-md">
      <img class="max-w-[85%] max-h-[85%] object-contain" alt="${p.name}" src="${artOf(p)}">
    </div>
    <h3 class="text-lg font-semibold text-cyan-100 drop-shadow">${cap(p.name)}</h3>
    <div class="text-sm opacity-80 capitalize text-blue-200">Tipo: ${typesOf(p).join(', ')}</div>
  `

  card.addEventListener('click',(e)=>{ if(e.target.classList.contains('fav')) return; openModal(p) })
  card.querySelector('.fav').addEventListener('click',e=>{
    e.stopPropagation()
    if(favs.has(p.id)){favs.delete(p.id); e.target.textContent='☆'}
    else{favs.add(p.id); e.target.textContent='⭐'}
    saveFavs(); if(showFavsOnly) applyFilters()
  })

  GRID.appendChild(card)
}

function statBar(label,value){
  const pct = Math.min(100,Math.round((value/200)*100))
  return `
    <div>
      <div class="flex justify-between text-sm"><span>${label}</span><span>${value}</span></div>
      <div class="h-2 rounded bg-cyan-900/40 overflow-hidden">
        <div class="h-full bg-gradient-to-r from-cyan-400 to-blue-500" style="width:${pct}%"></div>
      </div>
    </div>
  `
}

function openModal(p){
  MODAL_IMG.src = artOf(p)
  MODAL_TITLE.textContent = `#${pad(p.id)} · ${cap(p.name)}`
  MODAL_TYPES.innerHTML = `<b class="capitalize">${typesOf(p).join(', ')}</b>`
  MODAL_HEIGHT.textContent = `${(p.height/10).toFixed(1)} m`
  MODAL_WEIGHT.textContent = `${(p.weight/10).toFixed(1)} kg`
  MODAL_ABIL.innerHTML = p.abilities.map(a=>cap(a.ability.name)).join(', ')
  MODAL_STATS.innerHTML = p.stats.map(s=>statBar(cap(s.stat.name),s.base_stat)).join('')
  MODAL.classList.remove('hidden'); MODAL.classList.add('flex')
  MODAL.querySelectorAll('[data-close]').forEach(el=>el.onclick=()=>MODAL.classList.add('hidden'))
}

function applyFilters(){
  const q=(SEARCH.value||'').toLowerCase()
  const t=TYPE_FILTER.value
  let visible=0
  Array.from(GRID.children).forEach(card=>{
    const name=card.dataset.name, id=card.dataset.id, types=card.dataset.types.split(',')
    const isFav=favs.has(+id)
    const show=(!q||name.includes(q)||pad(id).includes(q)||id===q)&&(!t||types.includes(t))&&(!showFavsOnly||isFav)
    card.classList.toggle('hidden',!show); if(show) visible++
  })
  EMPTY.classList.toggle('hidden',visible!==0)
}

async function loadTypes() {
  const res = await fetch("https://pokeapi.co/api/v2/type")
  const data = await res.json()
  const types = data.results.map(t => t.name).filter(t => !["unknown","shadow"].includes(t))
  types.forEach(t => {
    const opt = document.createElement("option")
    opt.value = t
    opt.textContent = cap(t)
    TYPE_FILTER.appendChild(opt)
  })
}

// Eventos
SEARCH.addEventListener('input',applyFilters)
TYPE_FILTER.addEventListener('change',applyFilters)
BTN_CLEAR.addEventListener('click',()=>{SEARCH.value='';TYPE_FILTER.value='';showFavsOnly=false;applyFilters()})
BTN_LOAD.addEventListener('click',loadNextPage)
BTN_FAVS.addEventListener('click',()=>{showFavsOnly=!showFavsOnly;applyFilters()})
BTN_SHINY.addEventListener('click',()=>{shinyMode=!shinyMode;GRID.innerHTML='';loadedMax=0;loadNextPage()})

// Start
;(async()=>{setLoading(true);await loadTypes();await loadNextPage();setLoading(false);applyFilters()})()
