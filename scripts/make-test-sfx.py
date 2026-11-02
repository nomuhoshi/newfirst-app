# 生成音频兼容性测试用的原创提示音（880Hz 正弦，0.3 秒，带起音和衰减）。运行：python3 scripts/make-test-sfx.py
import wave, struct, math
sr = 22050; dur = 0.3; n = int(sr * dur)
with wave.open("public/sfx/test-beep.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    for i in range(n):
        t = i / sr
        env = min(1, t / 0.008) * math.exp(-t * 9)
        w.writeframes(struct.pack("<h", int(32767 * 0.6 * env * math.sin(2 * math.pi * 880 * t))))
