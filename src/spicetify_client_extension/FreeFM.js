// @ts-check

(function MusicSwitcher() {
    if (!Spicetify.Player || !Spicetify.Platform) {
        setTimeout(MusicSwitcher, 1000);
        return;
    }

    const SERVER_URL = "";
    const myTracks = {
        "грустная история": "Madk1d_Грустная_история.mp3"
    };

    const localAudio = new Audio();
    let isCustomPlaying = false;
    let originalVolume = 1; // Храним громкость, которая была до подмены

    // Функция синхронизации громкости
    const syncVolume = () => {
        // Мы берем громкость из интерфейса Spotify и применяем к нашему файлу
        localAudio.volume = Spicetify.Player.getVolume();
    };

    // Функция синхронизации времени (перемотка)
    const syncSeek = () => {
        if (isCustomPlaying) {
            const spotifyTime = Spicetify.Player.getProgress() / 1000;
            // Если разница больше 1.5 сек, значит пользователь перемотал вручную
            if (Math.abs(localAudio.currentTime - spotifyTime) > 1.5) {
                localAudio.currentTime = spotifyTime;
            }
        }
    };

    localAudio.onended = () => {
        isCustomPlaying = false;
        Spicetify.Player.next();
    };

    // Основной обработчик событий плеера
    Spicetify.Player.addEventListener("appplayerstatechange", () => {
        const data = Spicetify.Player.data;
        if (!data || !data.item) return;

        const spotifyTrackName = data.item.name.toLowerCase();

        if (myTracks[spotifyTrackName]) {
            if (!isCustomPlaying) {
                console.log("Подмена началась");
                isCustomPlaying = true;
                
                localAudio.src = SERVER_URL + myTracks[spotifyTrackName];
                localAudio.load();
                
                // ВАЖНО: Мы НЕ ставим на паузу. Мы просто глушим звук Spotify.
                // Но так как Spicetify API не всегда дает заглушить только один поток,
                // мы просто будем постоянно следить, чтобы наш файл играл, если Spotify играет.
                localAudio.play().catch(e => console.error(e));
                Spicetify.showNotification("Играет ваш локальный файл");
            }

            // Синхронизация паузы/плея
            if (data.is_paused && !localAudio.paused) {
                localAudio.pause();
            } else if (!data.is_paused && localAudio.paused) {
                localAudio.play().catch(() => {});
            }

            syncVolume();
            syncSeek();

        } else {
            // Возврат к обычному режиму
            if (isCustomPlaying) {
                localAudio.pause();
                localAudio.src = "";
                isCustomPlaying = false;
            }
        }
    });

    // Обработка кнопки паузы (onplaypause ловит именно клик по кнопке)
    Spicetify.Player.addEventListener("onplaypause", () => {
        if (isCustomPlaying) {
            if (localAudio.paused) {
                localAudio.play();
            } else {
                localAudio.pause();
            }
        }
    });
})();