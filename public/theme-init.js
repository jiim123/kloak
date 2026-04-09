(function() {
  try {
    var stored = localStorage.getItem('kloak-ui');
    if (stored) {
      var parsed = JSON.parse(stored);
      var theme = parsed.state && parsed.state.theme;
      if (theme && (theme === 'default' || theme === 'light')) {
        document.documentElement.className = theme;
        document.documentElement.setAttribute('data-theme', theme);
      } else {
        // Reset any removed themes to default
        document.documentElement.className = 'default';
        document.documentElement.setAttribute('data-theme', 'default');
      }
    }
  } catch (e) {
    document.documentElement.className = 'default';
    document.documentElement.setAttribute('data-theme', 'default');
  }
})();
