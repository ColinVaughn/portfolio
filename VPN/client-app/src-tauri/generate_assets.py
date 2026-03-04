import sys
import os

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow"])
    from PIL import Image, ImageDraw, ImageFilter, ImageFont

# Define paths
icon_path = r"c:\Users\Texbo\Desktop\VPN\client-app\src-tauri\icons\icon.png"
out_dir = r"c:\Users\Texbo\Desktop\VPN\client-app\src-tauri\assets"
os.makedirs(out_dir, exist_ok=True)

# Colors
bg_color = (25, 27, 40) # dark sleek navy
accent_color = (55, 75, 200) # deep vibrant blue
white = (255, 255, 255)

# --- Dialog Image 493x312 ---
# Standard WiX places text on the right. Left 164 pixels should be our design. 
dialog = Image.new('RGB', (493, 312), white)
draw_dialog = ImageDraw.Draw(dialog)
draw_dialog.rectangle([0, 0, 163, 312], fill=bg_color)

# Add a subtle gradient
for y in range(312):
    r = int(bg_color[0] + (accent_color[0] - bg_color[0]) * y / 600)
    g = int(bg_color[1] + (accent_color[1] - bg_color[1]) * y / 600)
    b = int(bg_color[2] + (accent_color[2] - bg_color[2]) * y / 600)
    draw_dialog.line([(0, y), (163, y)], fill=(r, g, b))

# Add the app icon to the sidebar
try:
    icon = Image.open(icon_path).convert("RGBA")
    target_size = 90
    icon = icon.resize((target_size, target_size), Image.Resampling.LANCZOS)
    icon_x = (164 - target_size) // 2
    icon_y = (312 - target_size) // 2 - 30 # Slightly above center
    dialog.paste(icon, (icon_x, icon_y), icon)
except Exception as e:
    print(f"Could not add icon: {e}")

dialog.save(os.path.join(out_dir, "dialog.bmp"))

# --- Banner Image 493x58 ---
banner = Image.new('RGB', (493, 58), white)
draw_banner = ImageDraw.Draw(banner)

# Let's add a subtle line separator at the bottom of the banner
draw_banner.line([(0, 57), (493, 57)], fill=(220, 220, 220))

try:
    icon_small = Image.open(icon_path).convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    # Right align the icon
    banner.paste(icon_small, (493 - 40 - 15, 9), icon_small)
except Exception as e:
    pass

banner.save(os.path.join(out_dir, "banner.bmp"))
print("Assets generated successfully!")
