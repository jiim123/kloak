(function() {
  try {
    var stored = localStorage.getItem('kloak-ui');
    if (stored) {
      var parsed = JSON.parse(stored);
      var theme = parsed.state && parsed.state.theme;
      if (theme) {
        document.documentElement.className = theme;
        document.documentElement.setAttribute('data-theme', theme);
      }
    }
  } catch (e) {
    // Fallback to dark theme
    document.documentElement.className = 'dark';
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
