// Slot machine animation
$(document).ready(function() {
    var wordlist = [
        'Movies', 'TV Shows', 'Series', 'Films', 'Cinema',
        'Drama', 'Action', 'Comedy', 'Thriller', 'Horror',
        'Romance', 'Sci-Fi', 'Fantasy', 'Documentary', 'Animation'
    ];

    var $container = $('#wordbox .slottt-machine-recipe__items_container');
    var itemHeight = 48;
    var currentIndex = 0;
    var isAnimating = false;

    // Clear container and add items
    $container.empty();
    wordlist.forEach(function(word) {
        var coloredText = word.replace(/s/gi, '<span style="color: rgba(255, 102, 196, 1)">s</span>');
        $container.append('<div class="slottt-machine-recipe__item">' + coloredText + '</div>');
});

    // Add items again for continuous loop
    wordlist.forEach(function(word) {
        var coloredText = word.replace(/s/gi, '<span style="color: rgba(255, 102, 196, 1)">s</span>');
        $container.append('<div class="slottt-machine-recipe__item">' + coloredText + '</div>');
    });

function animate() {
  if (isAnimating) return;
  isAnimating = true;

  currentIndex++;
        $container.css({
    transition: 'top 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
    top: -currentIndex * itemHeight + 'px'
  });

        setTimeout(function() {
            // Move first item to end
            var $firstItem = $container.find('.slottt-machine-recipe__item').first();
            $firstItem.appendTo($container);

            // Reset position without animation
            $container.css({
      transition: 'none',
                top: -(currentIndex - 1) * itemHeight + 'px'
    });

            // Force reflow
            $container[0].offsetHeight;

            // Restore animation
            $container.css({
      transition: 'top 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                top: -(currentIndex - 1) * itemHeight + 'px'
    });

    currentIndex--;
    isAnimating = false;
  }, 1200);
}

    // Start animation
    $container.css({
    top: '0',
    transition: 'top 1.2s cubic-bezier(0.4, 0, 0.2, 1)'
  });

  setInterval(animate, 3000);
});
