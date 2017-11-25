import * as session from './session';

(function () {
  // Handle download links
  const els = document.querySelectorAll('.__download-link');

  let location = null;
  let platform = null;

  if (navigator.platform.toLowerCase().indexOf('mac') !== -1) {
    platform = 'Mac';
    location = '/download/#mac';
  } else if (navigator.platform.toLowerCase().indexOf('win') !== -1) {
    platform = 'Windows';
    location = '/download/#windows';
  } else if (navigator.platform.toLowerCase().indexOf('linux') !== -1) {
    platform = 'Linux';
    location = '/download/#ubuntu';
  }

  for (let i = 0; i < els.length; i++) {
    const el = els[i];

    if (platform) {
      el.innerHTML = 'Download The App';
    }

    if (location) {
      el.onclick = function (e) {
        e.preventDefault();
        window.location = location;
      };
    }
  }
})();

(function () {
  // Style changelog list items
  const changelogListItems = document.querySelectorAll('.changelog__list-item');
  for (let i = 0; i < changelogListItems.length; i++) {
    const item = changelogListItems[i];
    const match = item.innerHTML.match(/\(PR:(\d+)(:([^)]+))?\)/);
    if (match) {
      const prNumber = match[1];
      const user = match[3] || '';
      const userString = (user ? ' by ' + user : '');
      const anchor = document.createElement('a');
      anchor.target = '_blank';
      anchor.href = 'https://github.com/getinsomnia/insomnia/pull/' + prNumber;
      anchor.innerHTML = '(#' + prNumber + userString + ')';
      item.innerHTML = item.innerHTML.replace(match[0], '');
      item.appendChild(anchor);
    }
  }
})();

(function () {
  // Add linkable anchors
  const headers = document.querySelectorAll([
    'article h1[id]',
    'article h2[id]',
    'article h3[id]'
  ].join(', '));
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    h.style.cursor = 'pointer';

    h.addEventListener('click', function (e) {
      window.location.hash = '#' + e.target.getAttribute('id');
    });
  }
})();

(function () {
  // Replace images with links to images
  for (const img of document.querySelectorAll('article img')) {
    const a = document.createElement('a');
    a.href = img.getAttribute('src');
    a.target = '_blank';
    if (!img.hasAttribute('title') && img.hasAttribute('alt')) {
      img.setAttribute('title', img.getAttribute('alt'));
    }
    img.parentNode.replaceChild(a, img);
    a.appendChild(img);
  }
})();

!function (e, o, n) {
  window.HSCW = o;
  window.HS = n;
  n.beacon = n.beacon || {};
  const t = n.beacon;
  t.userConfig = {};
  t.readyQueue = [];
  t.config = function (e) {
    this.userConfig = e
  };
  t.ready = function (e) {
    this.readyQueue.push(e)
  };
  o.config = {
    docs: {enabled: !0, baseUrl: "//insomnia.helpscoutdocs.com/"},
    contact: {enabled: !0, formId: "a9f6c8aa-b1dd-11e7-b466-0ec85169275a"}
  };
  const r = e.getElementsByTagName("script")[0], c = e.createElement("script");
  c.type = "text/javascript";
  c.async = !0;
  c.src = "https://djtflbt20bdde.cloudfront.net/";
  r.parentNode.insertBefore(c, r);
}(document, window.HSCW || {}, window.HS || {});

HS.beacon.config({
  color: '#6e60cc',
  icon: 'message',
  attachment: true,
  poweredBy: false,
  showSubject: true,
  showContactFields: true,
  topics: [
    {val: 'app', label: 'Desktop App'},
    {val: 'bug report', label: 'Bug Report'},
    {val: 'account', label: 'Plus or Teams Account'},
    {val: 'question', label: 'Question'},
    {val: 'plugin', label: 'Plugin Development'},
    {val: 'other', label: 'Other'},
  ]
});

HS.beacon.ready(async () => {
  const data = await session.whoami();
  HS.beacon.identify({
    name: `${data.firstName} ${data.lastName || ''}`.trim(),
    email: data.email,
    // Custom
    'Account ID': data.accountId,
    'Plan Name': data.planName
  });
});
