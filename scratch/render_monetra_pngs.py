from PIL import Image, ImageDraw, ImageFilter

def create_monetra_logo(size=512, is_full_bleed=True):
    scale = 4
    canvas_size = size * scale
    
    def s(v):
        return v * (canvas_size / 128.0)

    # 1. Background gradient image (luxury obsidian dark theme #161D27 -> #070A0F)
    bg_img = Image.new('RGBA', (canvas_size, canvas_size))
    bg_draw = ImageDraw.Draw(bg_img)
    for y in range(canvas_size):
        t = y / float(canvas_size)
        r = int(22 * (1 - t) + 7 * t)
        g = int(29 * (1 - t) + 10 * t)
        b = int(39 * (1 - t) + 15 * t)
        bg_draw.line([(0, y), (canvas_size, y)], fill=(r, g, b, 255))

    if is_full_bleed:
        # Full bleed square for mobile home screen / PWA maskable icon & Apple touch icon
        # Fills 100% of the canvas so launcher masks (circle, squircle, pebble) never crop outer borders
        img = bg_img
        draw = ImageDraw.Draw(img)
    else:
        # Squircle with transparent corners & subtle gold rim for desktop browser tab favicon
        mask = Image.new('L', (canvas_size, canvas_size), 0)
        mask_draw = ImageDraw.Draw(mask)
        x0, y0, x1, y1 = s(5), s(5), s(123), s(123)
        squircle_r = s(32)
        mask_draw.rounded_rectangle([x0, y0, x1, y1], radius=squircle_r, fill=255)

        img = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
        img.paste(bg_img, (0, 0), mask)
        draw = ImageDraw.Draw(img)
        draw.rounded_rectangle([x0, y0, x1, y1], radius=squircle_r, outline=(245, 186, 114, 180), width=int(s(2.5)))

    # Warm ambient glow in center
    glow = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_cx, glow_cy, glow_r = s(64), s(64), s(42)
    glow_draw.ellipse([glow_cx - glow_r, glow_cy - glow_r, glow_cx + glow_r, glow_cy + glow_r], fill=(227, 154, 94, 60))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=int(s(16))))
    img = Image.alpha_composite(img, glow)
    draw = ImageDraw.Draw(img)

    # 2. Golden M Monogram
    # Left Pillar
    lp_x0, lp_y0 = s(26), s(34)
    lp_w, lp_h = s(15), s(60)
    draw.rounded_rectangle([lp_x0, lp_y0, lp_x0 + lp_w, lp_y0 + lp_h], radius=s(7.5), fill=(245, 186, 114, 255))

    # Right Pillar
    rp_x0, rp_y0 = s(87), s(34)
    rp_w, rp_h = s(15), s(60)
    draw.rounded_rectangle([rp_x0, rp_y0, rp_x0 + rp_w, rp_y0 + rp_h], radius=s(7.5), fill=(245, 186, 114, 255))

    # Center Chevron
    chev_pts = [
        (s(33.5), s(41.5)),
        (s(64), s(73)),
        (s(94.5), s(41.5))
    ]
    draw.line([chev_pts[0], chev_pts[1]], fill=(245, 186, 114, 255), width=int(s(15)), joint="curve")
    draw.line([chev_pts[1], chev_pts[2]], fill=(245, 186, 114, 255), width=int(s(15)), joint="curve")
    # Round joint cap at apex
    draw.ellipse([s(64) - s(7.5), s(73) - s(7.5), s(64) + s(7.5), s(73) + s(7.5)], fill=(245, 186, 114, 255))

    # 3. Emerald Upward Growth Pulse Line
    pulse_pts = [
        (s(66), s(94)),
        (s(77), s(82)),
        (s(86), s(87)),
        (s(98), s(71))
    ]
    for i in range(len(pulse_pts) - 1):
        draw.line([pulse_pts[i], pulse_pts[i+1]], fill=(79, 211, 164, 255), width=int(s(5)), joint="curve")

    # Arrowhead
    draw.line([(s(91), s(71)), (s(98), s(71))], fill=(79, 211, 164, 255), width=int(s(5)))
    draw.line([(s(98), s(71)), (s(98), s(78))], fill=(79, 211, 164, 255), width=int(s(5)))

    # 4. Glowing AI Sparkle Dot
    dot_cx, dot_cy = s(100), s(28)
    draw.ellipse([dot_cx - s(5), dot_cy - s(5), dot_cx + s(5), dot_cy + s(5)], fill=(79, 211, 164, 255))
    draw.ellipse([dot_cx - s(2.5), dot_cy - s(2.5), dot_cx + s(2.5), dot_cy + s(2.5)], fill=(255, 255, 255, 255))

    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

if __name__ == '__main__':
    # 1. Desktop Browser Favicons
    fav = create_monetra_logo(64, is_full_bleed=False)
    fav.save('public/favicon.png', 'PNG')

    # 2. Apple iOS Touch Icon (Full bleed square per Apple HIG)
    apple_icon = create_monetra_logo(180, is_full_bleed=True)
    apple_icon.save('public/apple-touch-icon.png', 'PNG')

    # 3. Android PWA Icons (Full bleed maskable per W3C PWA spec)
    icon_192 = create_monetra_logo(192, is_full_bleed=True)
    icon_192.save('public/icon-192.png', 'PNG')

    icon_512 = create_monetra_logo(512, is_full_bleed=True)
    icon_512.save('public/icon-512.png', 'PNG')

    # Dedicated Maskable file
    icon_maskable = create_monetra_logo(512, is_full_bleed=True)
    icon_maskable.save('public/icon-maskable-512.png', 'PNG')

    print("All Monetra mobile app icons & favicons successfully created with perfect safe zone!")
