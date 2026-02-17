// Tiny hash router for Memetown views (home/arcade/wiki)

(() => {
  const views = {
    home: document.getElementById('view-home'),
    arcade: document.getElementById('view-arcade'),
    wiki: document.getElementById('view-wiki'),
  };

  const links = Array.from(document.querySelectorAll('[data-route-link]'));

  function routeName(){
    const raw = (location.hash || '').replace(/^#\/?/, '');
    const name = raw.split('?')[0].split('#')[0].trim().toLowerCase();
    if (!name || name === 'home') return 'home';
    if (name === 'arcade') return 'arcade';
    if (name === 'wiki') return 'wiki';
    return 'home';
  }

  function setActiveNav(name){
    links.forEach(a => {
      const on = a.getAttribute('data-route-link') === name;
      a.classList.toggle('is-on', on);
      a.setAttribute('aria-current', on ? 'page' : 'false');
    });
  }

  function animateIn(node){
    if (!node) return;
    node.classList.remove('is-enter');
    // force reflow
    void node.offsetWidth;
    node.classList.add('is-enter');
    setTimeout(() => node.classList.remove('is-enter'), 260);
  }

  function applyRoute(){
    const name = routeName();

    Object.entries(views).forEach(([k, v]) => {
      if (!v) return;
      v.hidden = k !== name;
    });

    setActiveNav(name);

    if (name === 'home') document.title = 'Memetown';
    else document.title = `Memetown • ${name[0].toUpperCase()}${name.slice(1)}`;

    animateIn(views[name]);
  }

  window.addEventListener('hashchange', applyRoute);

  // default hash
  if (!location.hash || location.hash === '#') {
    location.replace('#/home');
  }

  applyRoute();
})();
