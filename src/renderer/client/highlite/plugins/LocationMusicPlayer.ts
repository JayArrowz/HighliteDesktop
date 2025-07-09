import { Plugin } from "../core/interfaces/highlite/plugin/plugin.class";
import { SettingsTypes } from "../core/interfaces/highlite/plugin/pluginSettings.interface";

export interface MusicZone {
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
    sound: string;
    areaName: string;
    volume?: number;
    priority?: number;
}

export class LocationMusicPlayer extends Plugin {
    pluginName = "Location Music Player";
    author = "JayArrowz";
    
    private audioElements: Map<string, HTMLAudioElement> = new Map();
    private currentZone: MusicZone | null = null;
    private fadeInterval: NodeJS.Timeout | null = null;
    private isGameReady = false;
    
    private musicZones: MusicZone[] = [
        { xMin: -350, yMin: -25, xMax: -300, yMax: 25, sound: "adventure.mp3", areaName: "Hedge", volume: 0.6, priority: 1 },
    ];

    constructor() {
        super();
        
        this.settings.enable = {
            text: "Enable Location Music",
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => this.toggleMusic()
        };
        
        this.settings.masterVolume = {
            text: "Master Volume",
            type: SettingsTypes.range,
            value: 50,
            callback: () => this.updateVolume()
        };
        
        this.settings.fadeDuration = {
            text: "Fade Duration (ms)",
            type: SettingsTypes.range,
            value: 2000,
            callback: () => {}
        };
        
        this.settings.checkInterval = {
            text: "Position Check Interval (ms)",
            type: SettingsTypes.range,
            value: 1000,
            callback: () => {}
        };
        
        this.settings.enableLogging = {
            text: "Enable Debug Logging",
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {}
        };
    }

    init(): void {
        this.log("Initializing Location Music Player");
        this.preloadAudioFiles();
    }

    start(): void {
        this.log("Started Location Music Player");
        this.isGameReady = false;
        this.waitForGameReady();
    }

    stop(): void {
        this.log("Stopped Location Music Player");
        this.isGameReady = false;
        this.clearFadeInterval();
        this.stopAllMusic();
        this.currentZone = null;

    }

    SocketManager_loggedIn(): void {
        this.log("Player logged in, setting up music player");
        this.isGameReady = false;
        this.waitForGameReady();
    }

    SocketManager_handleLoggedOut(): void {
        this.log("Player logged out, stopping music");
        this.isGameReady = false;
        this.stopAllMusic();
        this.currentZone = null;
    }

    GameLoop_update(): void {
        if (!this.settings.enable.value || !this.isGameReady) return;
        
        if (Date.now() % (this.settings.checkInterval.value as number) < 50) {
            this.checkPlayerLocation();
        }
    }

    private waitForGameReady(attempt: number = 1, maxAttempts: number = 30): void {
        const isReady = this.checkGameReadiness();
        
        if (isReady) {
            this.log("Game is ready, starting music player");
            this.isGameReady = true;
            if (this.settings.enable.value) {
                this.checkPlayerLocation();
            }
            return;
        }

        if (attempt >= maxAttempts) {
            this.log("Max attempts reached, game may not be fully loaded");
            return;
        }

        const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
        setTimeout(() => {
            this.waitForGameReady(attempt + 1, maxAttempts);
        }, delay);
    }

    private checkGameReadiness(): boolean {
        const entityManager = (document as any).highlite?.gameHooks?.EntityManager?.Instance;
        const mainPlayer = entityManager?.MainPlayer;
        return !!(entityManager && mainPlayer && mainPlayer.CurrentGamePosition);
    }

    private preloadAudioFiles(): void {
        this.musicZones.forEach(zone => {
            if (!this.audioElements.has(zone.sound)) {
                const audio = new Audio();
                audio.src = `media/music/${zone.sound}`;
                audio.loop = true;
                audio.volume = 0;
                audio.preload = 'auto';
                
                // Handle audio loading errors
                audio.addEventListener('error', (e) => {
                    this.log(`Failed to load audio: ${zone.sound}`);
                });
                
                audio.addEventListener('canplaythrough', () => {
                    if (this.settings.enableLogging.value) {
                        this.log(`Audio loaded: ${zone.sound}`);
                    }
                });
                
                this.audioElements.set(zone.sound, audio);
            }
        });
    }

    private checkPlayerLocation(): void {
        try {
            const mainPlayer = (document as any).highlite?.gameHooks?.EntityManager?.Instance?.MainPlayer;
            if (!mainPlayer?.CurrentGamePosition) {
                this.log("No player position available");
                return;
            }
            
            const playerPos = mainPlayer.CurrentGamePosition;
            const playerX = playerPos.X;
            const playerZ = playerPos.Z;
            
            if (this.settings.enableLogging.value) {
                this.log(`Player position: X=${playerX}, Z=${playerZ}`);
            }
            
            let targetZone: MusicZone | null = null;
            let highestPriority = -1;
            
            for (const zone of this.musicZones) {
                if (this.settings.enableLogging.value) {
                    this.log(`Checking zone: X(${zone.xMin}-${zone.xMax}), Z(${zone.yMin}-${zone.yMax}), Name: ${zone.areaName}, Sound: ${zone.sound}`);
                }
                
                if (this.isPlayerInZone(playerX, playerZ, zone)) {
                    const priority = zone.priority || 0;
                    if (priority > highestPriority) {
                        highestPriority = priority;
                        targetZone = zone;
                    }
                }
            }
            
            if (targetZone !== this.currentZone) {
                this.log(`Zone changed from ${this.currentZone?.sound || 'none'} to ${targetZone?.sound || 'none'}`);
                this.transitionToZone(targetZone);
            }
            
        } catch (error) {
            console.error("Error checking player location:", error);
        }
    }

    private isPlayerInZone(playerX: number, playerZ: number, zone: MusicZone): boolean {
        return playerX >= zone.xMin && 
               playerX <= zone.xMax && 
               playerZ >= zone.yMin && 
               playerZ <= zone.yMax;
    }

    private transitionToZone(newZone: MusicZone | null): void {
        if (this.settings.enableLogging.value) {
            this.log(`Transitioning from ${this.currentZone?.sound || 'silence'} to ${newZone?.sound || 'silence'}`);
        }
        
        if (this.currentZone) {
            this.fadeOutMusic(this.currentZone.sound);
        }
        
        if (newZone) {
            this.fadeInMusic(newZone.sound, newZone.volume || 1.0);
        }
        
        this.currentZone = newZone;
    }

        private fadeInMusic(soundFile: string, targetVolume: number): void {
        const audio = this.audioElements.get(soundFile);
        if (!audio) {
            this.log(`Audio element not found for: ${soundFile}`);
            return;
        }
        
        this.log(`Attempting to play: ${soundFile} at volume ${targetVolume}`);
        
        audio.currentTime = 0;
        audio.volume = 0;
        
        audio.play().then(() => {
            this.log(`Successfully started playing: ${soundFile}`);
            this.fadeAudio(audio, 0, targetVolume * (this.settings.masterVolume.value as number) / 100);
        }).catch(error => {
            this.log(`Failed to play audio: ${soundFile} - ${error.name}: ${error.message}`);
        });
    }

    private fadeOutMusic(soundFile: string): void {
        const audio = this.audioElements.get(soundFile);
        if (!audio) return;
        
        this.fadeAudio(audio, audio.volume, 0, () => {
            audio.pause();
        });
    }

    private fadeAudio(audio: HTMLAudioElement, startVolume: number, endVolume: number, onComplete?: () => void): void {
        this.clearFadeInterval();
        
        const fadeDuration = this.settings.fadeDuration.value as number;
        const steps = 50;
        const stepDuration = fadeDuration / steps;
        const volumeStep = (endVolume - startVolume) / steps;
        
        let currentStep = 0;
        audio.volume = startVolume;
        
        this.fadeInterval = setInterval(() => {
            currentStep++;
            audio.volume = Math.max(0, Math.min(1, startVolume + (volumeStep * currentStep)));
            
            if (currentStep >= steps) {
                this.clearFadeInterval();
                audio.volume = endVolume;
                if (onComplete) onComplete();
            }
        }, stepDuration);
    }

    private clearFadeInterval(): void {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
    }

    private toggleMusic(): void {
        if (this.settings.enable.value) {
            if (this.isGameReady) {
                this.checkPlayerLocation();
            }
        } else {
            this.stopAllMusic();
            this.currentZone = null;
        }
    }

    private updateVolume(): void {
        if (this.currentZone) {
            const audio = this.audioElements.get(this.currentZone.sound);
            if (audio && !audio.paused) {
                const zoneVolume = this.currentZone.volume || 1.0;
                audio.volume = zoneVolume * (this.settings.masterVolume.value as number) / 100;
            }
        }
    }

    private stopAllMusic(): void {
        this.log("Stopping all music");
        this.clearFadeInterval();
        this.audioElements.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 0;
        });
    }

    public addMusicZone(zone: MusicZone): void {
        this.musicZones.push(zone);
        this.preloadAudioFiles();
    }

    public removeMusicZone(soundFile: string): void {
        this.musicZones = this.musicZones.filter(zone => zone.sound !== soundFile);
        const audio = this.audioElements.get(soundFile);
        if (audio) {
            audio.pause();
            this.audioElements.delete(soundFile);
        }
    }
} 