(function() {
  try {
    var stored = localStorage.getItem('kloak-ui');
    if (stored) {
      var parsed = JSON.parse(stored);
      var theme = parsed.state && parsed.state.theme;
      if (theme && (theme === 'default' || theme === 'light' || theme === 'amoled')) {
        document.documentElement.className = theme;
        document.documentElement.setAttribute('data-theme', theme);
      } else {
        document.documentElement.className = 'amoled';
        document.documentElement.setAttribute('data-theme', 'amoled');
      }
    }
  } catch (e) {
    document.documentElement.className = 'amoled';
    document.documentElement.setAttribute('data-theme', 'amoled');
  }
})();
