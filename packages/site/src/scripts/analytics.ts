// analytics.ts — consent-first Google Analytics.
//
// GDPR posture: nothing loads until the visitor explicitly opts in. No gtag,
// no cookies, no cookieless pings — the network stays silent. The banner offers
// ACCEPT and DECLINE with equal weight; either choice is remembered and the
// banner never returns (the "cookies" footer link reopens it for a change of
// mind). Withdrawing consent reloads the page, which tears gtag down entirely.
//
// The measurement ID arrives via PUBLIC_GA_ID at build time; without it (dev
// builds, forks) this module renders no banner and loads nothing.

const GA_ID = import.meta.env.PUBLIC_GA_ID as string | undefined
const KEY = 'meow-consent' // 'granted' | 'denied'

type GtagWindow = Window & { dataLayer: unknown[]; gtag: (...args: unknown[]) => void; __gaLoaded?: boolean }
const w = window as unknown as GtagWindow

function loadGa() {
  if (!GA_ID || w.__gaLoaded) return
  w.__gaLoaded = true
  w.dataLayer = w.dataLayer ?? []
  // eslint-disable-next-line prefer-rest-params -- gtag requires the live arguments object
  w.gtag = function () { w.dataLayer.push(arguments) } as GtagWindow['gtag']
  // Consent Mode v2: ads signals stay denied forever; analytics only runs
  // because the visitor said yes (this module doesn't load otherwise).
  w.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  })
  w.gtag('js', new Date())
  w.gtag('config', GA_ID, { send_page_view: false })
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(s)
  pageView() // the view that earned the consent
}

function pageView() {
  if (!w.__gaLoaded || localStorage.getItem(KEY) !== 'granted') return
  w.gtag('event', 'page_view', {
    page_location: location.href,
    page_title: document.title,
  })
}

// ---- the banner ----

function closeBanner() {
  const el = document.getElementById('cookie-banner')
  if (!el) return
  el.classList.remove('in')
  setTimeout(() => el.remove(), 250)
}

function decide(choice: 'granted' | 'denied') {
  localStorage.setItem(KEY, choice)
  closeBanner()
  if (choice === 'granted') loadGa()
  // withdrawal while gtag is live in this page: reload so it's gone for real
  // (checked against __gaLoaded, not the stored value — the "cookies" link
  // clears storage to reopen the banner, but the running tag is the truth)
  if (choice === 'denied' && w.__gaLoaded) location.reload()
}

function showBanner() {
  if (document.getElementById('cookie-banner')) return
  const el = document.createElement('aside')
  el.id = 'cookie-banner'
  el.className = 'cookie-banner'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-label', 'cookie consent')

  const title = document.createElement('p')
  title.className = 'cb-title'
  title.textContent = 'INSERT COOKIE?'
  const text = document.createElement('p')
  text.className = 'cb-text'
  text.append('we’d like to count visitors with google analytics. anonymous, no ads, and nothing loads unless you say yes. ')
  const more = document.createElement('a')
  more.href = '/privacy/'
  more.textContent = 'the fine print'
  text.append(more)

  const row = document.createElement('p')
  row.className = 'cb-actions'
  const yes = document.createElement('button')
  yes.className = 'btn cb-yes'
  yes.type = 'button'
  yes.textContent = 'SURE, COUNT ME'
  yes.addEventListener('click', () => decide('granted'))
  const no = document.createElement('button')
  no.className = 'btn btn--mint cb-no'
  no.type = 'button'
  no.textContent = 'NO THANKS'
  no.addEventListener('click', () => decide('denied'))
  row.append(yes, no)

  el.append(title, text, row)
  document.body.append(el)
  setTimeout(() => el.classList.add('in'), 30)
}

// ---- wiring (document listeners persist across ClientRouter swaps) ----

if (GA_ID) {
  const choice = localStorage.getItem(KEY)
  if (choice === 'granted') loadGa()
  else if (choice !== 'denied') {
    // undecided: (re)show the banner on first load and after navigations
    document.addEventListener('astro:page-load', () => {
      if (!localStorage.getItem(KEY)) showBanner()
    })
    showBanner()
  }

  // SPA navigations: report page views (no-op unless consented + loaded)
  document.addEventListener('astro:page-load', pageView)

  // "cookies" links (footer + privacy page) reopen the banner anywhere.
  // Capture phase + stopPropagation: this must beat the ClientRouter's own
  // click listener, or the link navigates and the body swap eats the banner.
  document.addEventListener(
    'click',
    (e) => {
      const link = (e.target as HTMLElement).closest('#cookie-settings, #cookie-settings-inline')
      if (!link) return
      e.preventDefault()
      e.stopPropagation()
      localStorage.removeItem(KEY)
      showBanner()
    },
    { capture: true },
  )
}
