const loadBtn = document.getElementById('loadBtn');
const moviesList = document.getElementById('moviesList');

loadBtn.addEventListener('click', () => {
    // Робимо запит на інший порт (перевірка CORS)
    fetch('http://127.0.0.1:8000/api/movies/')
        .then(response => {
            if (!response.ok) throw new Error('Помилка мережі або CORS');
            return response.json();
        })
        .then(data => {
            moviesList.innerHTML = ''; // Очищаємо контейнер
            
            // Проходимося по масиву даних і створюємо картки
            data.forEach(movie => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <h3>${movie.title} (${movie.year})</h3>
                    <p><strong>Режисер:</strong> ${movie.director_name}</p>
                    <p><strong>Рейтинг:</strong> ⭐️ ${movie.rating}</p>
                `;
                moviesList.appendChild(card);
            });
        })
        .catch(error => {
            console.error('Помилка:', error);
            moviesList.innerHTML = '<p style="color:red;">Помилка завантаження. Перевірте, чи працює бекенд і налаштування CORS.</p>';
        });
});