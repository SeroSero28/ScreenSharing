
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Settings from './Settings';

describe('Settings Component', () => {
  // Gerekli propları ve callback fonksiyonlarını taklit et (mock)
  const mockProps = {
    show: true,
    onHide: vi.fn(),
    voiceMode: 'continuous' as 'continuous' | 'push-to-talk',
    onVoiceModeChange: vi.fn(),
    pttKey: 'ControlLeft',
    onPttKeyChange: vi.fn(),
    selectedMicId: 'default',
    onMicrophoneChange: vi.fn(),
  };

  // navigator.mediaDevices.enumerateDevices fonksiyonunu taklit et
  // Bu gerekli çünkü bileşen render edildiğinde bu fonksiyonu çağırıyor
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      enumerateDevices: vi.fn().mockResolvedValue([
        { deviceId: 'default', kind: 'audioinput', label: 'Default Microphone' },
        { deviceId: 'mic2', kind: 'audioinput', label: 'USB Microphone' },
      ]),
      getUserMedia: vi.fn(), // Bu testte kullanılmıyor ama eklemek iyi bir pratik
    },
    writable: true,
  });

  // Her testten önce mockları temizle
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the settings modal with the title', async () => {
    render(<Settings {...mockProps} />);

    // "Ayarlar" başlığının görünüp görünmediğini kontrol et
    expect(screen.getByText('Ayarlar')).toBeInTheDocument();

    // Mikrofon seçim menüsünün render edilip edilmediğini kontrol et
    // async/await veya findBy* kullanarak render edilmesini bekle
    expect(await screen.findByText('Default Microphone')).toBeInTheDocument();
  });

  it('calls onVoiceModeChange when a voice mode radio button is clicked', () => {
    render(<Settings {...mockProps} />);

    // "Bas Konuş" radio butonunu etiketinden bul
    const pushToTalkRadio = screen.getByLabelText('Bas Konuş');

    // Kullanıcı tıklamasını simüle et
    fireEvent.click(pushToTalkRadio);

    // Callback fonksiyonunun doğru değerle çağrıldığını kontrol et
    expect(mockProps.onVoiceModeChange).toHaveBeenCalledWith('push-to-talk');
  });

  it('updates push-to-talk key when a new key is pressed', () => {
    // Bileşeni 'push-to-talk' modunda render et
    render(<Settings {...mockProps} voiceMode="push-to-talk" />);

    // Tuşu değiştirme butonunu bul
    const changeKeyButton = screen.getByText(mockProps.pttKey);

    // "Dinleme" moduna girmek için butona tıkla
    fireEvent.click(changeKeyButton);

    // Buton metninin dinleme moduna geçtiğini kontrol et
    expect(screen.getByText('Bir tuşa basın...')).toBeInTheDocument();

    // 'K' tuşuna basılmasını simüle et
    fireEvent.keyDown(window, { key: 'K', code: 'KeyK' });

    // Callback fonksiyonunun doğru tuş koduyla çağrıldığını kontrol et
    expect(mockProps.onPttKeyChange).toHaveBeenCalledWith('KeyK');
  });
});
