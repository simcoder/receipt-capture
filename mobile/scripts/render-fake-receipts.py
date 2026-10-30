#!/usr/bin/env python3
"""Draw cafe, fuel, and office receipts that read as thermal paper."""

from pathlib import Path
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parents[1] / "assets" / "fake-receipts"
FONT = "/System/Library/Fonts/Supplemental/Courier New.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Courier New Bold.ttf"
PAPER = (247, 244, 236)
INK = (28, 28, 28)
FAINT = (90, 86, 78)
RULE = (70, 66, 60)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def paper(width: int, height: int, seed: int) -> Image.Image:
    image = Image.new("RGB", (width, height), PAPER)
    pixels = image.load()
    rng = random.Random(seed)
    for y in range(0, height, 2):
        for x in range(0, width, 2):
            if rng.random() < 0.08:
                drift = rng.randint(-8, 6)
                r, g, b = pixels[x, y]
                pixels[x, y] = (max(0, r + drift), max(0, g + drift), max(0, b + drift))
    return image


def center(draw: ImageDraw.ImageDraw, text: str, y: int, face: ImageFont.FreeTypeFont, width: int, fill=INK) -> int:
    box = draw.textbbox((0, 0), text, font=face)
    draw.text(((width - (box[2] - box[0])) / 2, y), text, font=face, fill=fill)
    return y + (box[3] - box[1]) + 14


def pair(draw: ImageDraw.ImageDraw, left: str, right: str, y: int, face: ImageFont.FreeTypeFont, width: int, margin: int) -> int:
    draw.text((margin, y), left, font=face, fill=INK)
    box = draw.textbbox((0, 0), right, font=face)
    draw.text((width - margin - (box[2] - box[0]), y), right, font=face, fill=INK)
    return y + (box[3] - box[1]) + 16


def rule(draw: ImageDraw.ImageDraw, y: int, width: int, margin: int) -> int:
    draw.line((margin, y, width - margin, y), fill=RULE, width=2)
    return y + 16


def dashes(draw: ImageDraw.ImageDraw, y: int, width: int, margin: int) -> int:
    x = margin
    while x < width - margin:
        draw.line((x, y, min(x + 10, width - margin), y), fill=RULE, width=2)
        x += 18
    return y + 16


def barcode(draw: ImageDraw.ImageDraw, y: int, width: int, seed: int) -> int:
    rng = random.Random(seed)
    x = 70
    end = width - 70
    while x < end:
        bar = rng.choice((2, 2, 3, 4))
        gap = rng.choice((2, 3, 4))
        if rng.random() > 0.35:
            draw.rectangle((x, y, x + bar, y + 78), fill=INK)
        x += bar + gap
    return y + 92


def render(name: str, lines: list[tuple], seed: int) -> None:
    width, height = 760, 1400
    sheet = paper(width, height, seed)
    draw = ImageDraw.Draw(sheet)
    title = font(46, bold=True)
    body = font(28)
    small = font(22)
    total_face = font(34, bold=True)
    y = 48
    margin = 48
    for kind, *rest in lines:
        if kind == "title":
            y = center(draw, rest[0], y, title, width)
        elif kind == "center":
            y = center(draw, rest[0], y, small, width, FAINT)
        elif kind == "gap":
            y += rest[0]
        elif kind == "rule":
            y += 8
            y = rule(draw, y, width, margin)
        elif kind == "dash":
            y += 8
            y = dashes(draw, y, width, margin)
        elif kind == "pair":
            y = pair(draw, rest[0], rest[1], y, body, width, margin)
        elif kind == "total":
            y = pair(draw, rest[0], rest[1], y, total_face, width, margin)
        elif kind == "barcode":
            y = barcode(draw, y, width, seed)
        else:
            raise SystemExit(f"unknown line {kind}")

    sheet = sheet.crop((0, 0, width, min(height, y + 28)))
    paper_h = sheet.height
    canvas = Image.new("RGB", (width + 80, paper_h + 80), (214, 210, 202))
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((46, 50, width + 46, paper_h + 42), radius=8, fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    canvas.paste(shadow, (0, 0), shadow)
    canvas.paste(sheet, (32, 28))
    canvas = canvas.rotate(0.4, resample=Image.Resampling.BICUBIC, expand=False, fillcolor=(214, 210, 202))
    OUT.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT / name, "PNG")


CAFE = [
    ("title", "BLUE BOTTLE"),
    ("center", "COFFEE"),
    ("gap", 6),
    ("center", "66 Mint Street"),
    ("center", "San Francisco, CA 94103"),
    ("center", "10-29-2026   8:14 AM"),
    ("gap", 8),
    ("dash",),
    ("pair", "Drip coffee", "4.50"),
    ("pair", "Oat latte", "6.50"),
    ("pair", "Almond croissant", "5.50"),
    ("dash",),
    ("pair", "Subtotal", "16.50"),
    ("pair", "Tax", "2.00"),
    ("rule",),
    ("total", "TOTAL USD", "18.50"),
    ("gap", 8),
    ("center", "VISA  **** 4242"),
    ("center", "Auth 184392"),
    ("gap", 10),
    ("barcode",),
    ("center", "Thank you"),
    ("center", "No. 10482"),
]

FUEL = [
    ("title", "HIGHWAY FUEL"),
    ("center", "Station 214"),
    ("gap", 6),
    ("center", "1400 Airline Hwy"),
    ("center", "Baton Rouge, LA 70815"),
    ("center", "10-30-2026   7:02 AM"),
    ("center", "Pump 4"),
    ("gap", 8),
    ("dash",),
    ("pair", "Regular", "8.420 gal"),
    ("pair", "Price / gal", "3.899"),
    ("dash",),
    ("pair", "Fuel", "32.83"),
    ("pair", "Tax included", "0.00"),
    ("rule",),
    ("total", "TOTAL USD", "32.83"),
    ("gap", 8),
    ("center", "DEBIT  **** 1881"),
    ("center", "Auth 772014"),
    ("gap", 10),
    ("barcode",),
    ("center", "Thank you"),
    ("center", "Keep this receipt"),
]

OFFICE = [
    ("title", "NORTHWIND"),
    ("center", "OFFICE SUPPLY"),
    ("gap", 6),
    ("center", "1200 Poydras Street"),
    ("center", "New Orleans, LA 70112"),
    ("center", "10-28-2026   2:41 PM"),
    ("center", "Register 2"),
    ("gap", 8),
    ("dash",),
    ("pair", "Copy paper", "12.40"),
    ("pair", "Ballpoint pens", "6.15"),
    ("pair", "Notebook", "4.20"),
    ("dash",),
    ("pair", "Subtotal", "22.75"),
    ("pair", "Tax", "2.05"),
    ("rule",),
    ("total", "TOTAL USD", "24.80"),
    ("gap", 8),
    ("center", "MASTERCARD  **** 4410"),
    ("center", "Auth 330918"),
    ("gap", 10),
    ("barcode",),
    ("center", "Thank you"),
    ("center", "No. 55821"),
]


if __name__ == "__main__":
    render("cafe-receipt.png", CAFE, 18)
    render("fuel-receipt.png", FUEL, 22)
    render("office-receipt.png", OFFICE, 9)
