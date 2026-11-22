import json, os
R='/home/claude/hd/project'
P='#6C5CE7'; PS='#EEEBFF'; A='#00B894'; AS='#E1F7F0'; AD='#00805F'; W='#E5484D'; WS='#FFECEC'; INK='#17172A'; MU='#5F5F75'; LN='#E9E9F2'; BG='#F4F4FA'
ICON={
'back':'<path d="M9 6l6 6-6 6"/>',
'clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
'cal':'<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
'pin':'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
'users':'<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14c2.4.2 4 1.7 4.5 4.5"/>',
'chat':'<path d="M4 5h16v11H9l-5 4z"/>',
'compass':'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
'user':'<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.8-3.8 3.8-5.8 7.5-5.8s6.7 2 7.5 5.8"/>',
'play':'<path d="M8 5.5v13l11-6.5z"/>',
'pause':'<path d="M8 5v14M16 5v14"/>',
'reset':'<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
'lock':'<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
'check':'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
'shield':'<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12l2.3 2.3 4.2-4.6"/>',
'phone':'<rect x="7" y="2.8" width="10" height="18.4" rx="2.4"/><path d="M11 18h2"/>',
'bell':'<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
'star':'<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>',
'repeat':'<path d="M4 10V9a3 3 0 0 1 3-3h11l-3-3M20 14v1a3 3 0 0 1-3 3H6l3 3"/>',
'plus':'<path d="M12 5v14M5 12h14"/>',
'globe':'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>',
'switch':'<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
'eye':'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
'flag':'<path d="M5 21V4M5 4h11l-1.8 4L16 12H5"/>',
'heart':'<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
'more':'<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
'video':'<rect x="3" y="6.5" width="12.5" height="11" rx="2.5"/><path d="M15.5 10.5l5-3v9l-5-3"/>',
'coffee':'<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5v2.5M12 3.5v2.5"/>',
}
def ic(n,s=20,c='currentColor',sw=1.8,label=None):
    a=f'role="img" aria-label="{label}"' if label else 'aria-hidden="true"'
    return f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" {a}>{ICON[n]}</svg>'
def av(ch,bg,size=36,fg='#fff'):
    return f'<span aria-hidden="true" style="width:{size}px;height:{size}px;border-radius:50%;background:{bg};color:{fg};display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:{int(size*.42)}px;flex:none">{ch}</span>'
def chip(t,on=False,kind='p'):
    if on: st=f'background:{P};color:#fff'
    elif kind=='a': st=f'background:{AS};color:{AD}'
    elif kind=='g': st=f'background:#EFEFF6;color:{MU}'
    elif kind=='w': st=f'background:{WS};color:#B4272C'
    else: st=f'background:{PS};color:#5243C9'
    return f'<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;{st}">{t}</span>'
def chipbtn(t,on=False):
    st=f'background:{P};color:#fff;border:2px solid {P}' if on else f'background:#fff;color:{INK};border:2px solid {LN}'
    return f'<button type="button" style="font:inherit;font-size:13px;font-weight:700;min-height:44px;padding:0 16px;border-radius:999px;{st}">{t}</button>'
def btn(t,kind='p',full=True,icon=None,href=None):
    st={'p':f'background:{P};color:#fff','s':f'background:#EFEFF6;color:{INK}','g':f'background:transparent;color:{P};border:2px solid {P}','a':f'background:{A};color:#06372A','d':f'background:{WS};color:#B4272C'}[kind]
    w='width:100%;' if full else ''
    i=ic(icon,18) if icon else ''
    tag='a' if href else 'button'
    extra=f' href="{href}"' if href else ' type="button"'
    return f'<{tag}{extra} style="{w}box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 20px;border-radius:16px;border:0;font:inherit;font-size:14px;font-weight:800;text-decoration:none;{st}">{i}{t}</{tag}>'
CARD='background:#fff;border-radius:16px;padding:16px;box-shadow:0 4px 20px rgba(30,30,80,.05)'
SEC=f'font-size:12px;font-weight:800;color:{MU};margin:22px 4px 8px'
def top(title,back=True,right=''):
    b=f'<a href="Main.dc.html" aria-label="بازگشت" style="width:44px;height:44px;border-radius:14px;background:#fff;display:inline-flex;align-items:center;justify-content:center;color:{INK}">{ic("back",20)}</a>' if back else ''
    return f'<header style="display:flex;align-items:center;gap:10px;padding:14px 16px 6px">{b}<h1 style="margin:0;font-size:19px;font-weight:900;flex:1">{title}</h1>{right}</header>'
def nav(active):
    items=[('کشف','compass'),('جلسه‌ها','cal'),('جمع','users'),('چت','chat'),('من','user')]
    links={'جلسه‌ها':'Main.dc.html','جمع':'Together.dc.html'}
    out=''
    for t,i in items:
        on=t==active; c=P if on else MU
        badge='<span style="position:absolute;top:6px;inset-inline-end:16px;min-width:16px;height:16px;border-radius:8px;background:#E5484D;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center">۲</span>' if t=='چت' else ''
        href=links.get(t,'#')
        out+=f'<a href="{href}" style="position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 0 6px;text-decoration:none;color:{c};font-size:11px;font-weight:{"800" if on else "600"}"{" aria-current=\"page\"" if on else ""}>{ic(i,22,c,2 if on else 1.8)}{t}{badge}</a>'
    return f'<nav aria-label="منوی اصلی" style="position:absolute;bottom:0;left:0;right:0;height:76px;background:#fff;border-top:1px solid {LN};display:flex;padding:0 6px 10px">{out}</nav>'
FONT='<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700;800;900&amp;display=swap" rel="stylesheet">'
def page(title,body,w=390,h=844,navon=None,bg=BG,script_extra=''):
    navh=nav(navon) if navon else ''
    return f'''<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{FONT}
<style>
body{{margin:0}}
a{{color:{P}}}a:hover{{color:#5243C9}}
</style>
</helmet>
<div dir="rtl" style="width:{w}px;height:{h}px;box-sizing:border-box;position:relative;overflow:hidden;background:{bg};color:{INK};font-family:Vazirmatn,system-ui,sans-serif">
{body}
{navh}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
'''
FILES={}
# ---------- 1. Sessions (M1) ----------
def sess_card(name,col,when,what,mode,state):
    right={'join':btn('ورود به اتاق','a',False,'play'),
           'prop':f'<div style="display:flex;gap:8px">{btn("قبول","p",False)}{btn("یه وقت دیگه","s",False)}</div>',
           'wait':chip('منتظر جواب سارا','g')}[state]
    return f'''<article style="{CARD};display:flex;flex-direction:column;gap:12px">
<div style="display:flex;align-items:center;gap:12px">{av(name[0],col,44)}
<div style="flex:1;min-width:0"><div style="font-weight:800;font-size:15px">جلسه با {name}</div>
<div style="font-size:12.5px;color:{MU};display:flex;align-items:center;gap:6px;margin-top:2px">{ic("clock",15)}{when}</div></div>
{chip(mode,kind="a" if mode=="حضوری" else "p")}</div>
<div style="font-size:13px;color:{MU};display:flex;gap:6px;align-items:center">{ic("star",15)} هدف: <b style="color:{INK}">{what}</b></div>
<div>{right}</div></article>'''
body=top('جلسه‌ها',False,f'<a href="Schedule.dc.html" aria-label="جلسهٔ تازه" style="width:44px;height:44px;border-radius:14px;background:{P};color:#fff;display:inline-flex;align-items:center;justify-content:center">{ic("plus",22)}</a>')+f'''
<main style="padding:4px 16px 96px;display:flex;flex-direction:column;gap:10px">
<section aria-label="زنجیره" style="{CARD};display:flex;align-items:center;gap:14px;background:{P};color:#fff">
<div style="font-size:34px;font-weight:900;line-height:1">۴</div>
<div style="flex:1"><div style="font-weight:800">هفتهٔ چهارم پشت سر هم</div><div style="font-size:12.5px;opacity:.9">این هفته ۲ جلسه رفتی، ۱ تا مانده تا هدفت</div></div>
<div style="display:flex;gap:4px" aria-hidden="true">{"".join(f'<span style="width:10px;height:26px;border-radius:5px;background:{"#fff" if k<4 else "rgba(255,255,255,.35)"}"></span>' for k in range(6))}</div>
</section>
<h2 style="{SEC}">پیش رو</h2>
{sess_card("سارا","#6C5CE7","امروز، ۱۸:۳۰ · ۵۰ دقیقه · ۸ دقیقهٔ دیگه","پایان‌نامه — فصل ۳","آنلاین","join")}
{sess_card("نازنین","#00A383","پنج‌شنبه ۱ آذر، ۱۰:۰۰ · ۹۰ دقیقه","تمرین هلندی","حضوری","prop")}
{sess_card("لنا","#E17055","هر یکشنبه، ۰۹:۰۰ · ۲۵ دقیقه","ورزش صبح","آنلاین","wait")}
<h2 style="{SEC}">گذشته</h2>
<div style="{CARD};display:flex;align-items:center;gap:12px">{av("م","#0984E3",36)}<div style="flex:1;font-size:13px"><b>مینا</b> · سه‌شنبه · ۵۰ دقیقه</div>{chip(ic("check",14)+" انجام شد","a")}</div>
</main>'''
FILES['Main.dc.html']=page('جلسه‌ها — پیش رو',body,navon='جلسه‌ها')

# ---------- 2. Schedule form (M1) ----------
def row(label,content):
    return f'<div style="display:flex;flex-direction:column;gap:8px"><span style="font-size:13px;font-weight:800">{label}</span>{content}</div>'
inp='box-sizing:border-box;width:100%;min-height:48px;padding:0 14px;border-radius:16px;border:2px solid '+LN+';background:#fff;font:inherit;font-size:14px;color:'+INK
days=''.join(f'<button type="button" aria-pressed="{"true" if d in "دپ" else "false"}" style="width:40px;height:44px;border-radius:12px;font:inherit;font-weight:800;font-size:13px;border:2px solid {P if d in "دپ" else LN};background:{P if d in "دپ" else "#fff"};color:{"#fff" if d in "دپ" else INK}">{d}</button>' for d in 'شیدسچپج')
body=top('جلسه با سارا')+f'''
<form style="padding:6px 16px 24px;display:flex;flex-direction:column;gap:18px">
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
<label style="display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:800">تاریخ<input value="پنج‌شنبه ۱ آذر" style="{inp}"></label>
<label style="display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:800">ساعت<input value="۰۹:۰۰" dir="ltr" style="{inp};text-align:right"></label>
</div>
<div style="margin-top:-8px;font-size:12.5px;color:{MU};display:flex;align-items:center;gap:6px;background:#fff;border-radius:12px;padding:8px 12px">{ic("globe",16)} ساعت سارا: <b style="color:{INK}">۱۱:۳۰ (تهران)</b></div>
{row("مدت",f'<div style="display:flex;gap:8px;flex-wrap:wrap">{chipbtn("۲۵ دقیقه")}{chipbtn("۵۰ دقیقه",True)}{chipbtn("۹۰ دقیقه")}{chipbtn("دلخواه")}</div>')}
{row("شیوه",f'<div style="display:flex;gap:8px">{chipbtn("آنلاین")}{chipbtn("حضوری",True)}</div>')}
<label style="display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:800">مکان<input value="کتابخانهٔ مرکزی رتردام، طبقهٔ ۲" style="{inp}">
<span style="font-weight:600;font-size:12px;color:{MU};display:flex;gap:6px;align-items:center">{ic("shield",15)} جای عمومی پیشنهاد می‌شود. آدرس فقط برای سارا دیده می‌شود.</span></label>
<label style="display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:800">هدف این جلسه<select style="{inp}"><option>پایان‌نامه — فصل ۳</option></select></label>
{row("تکرار",f'<div style="display:flex;gap:8px">{chipbtn("یک‌بار")}{chipbtn("هفتگی",True)}</div><div style="display:flex;gap:6px;justify-content:space-between">{days}</div><div style="font-size:12px;color:{MU}">دوشنبه و پنج‌شنبه، تا ۶ هفته (۱۲ جلسه)</div>')}
{btn("فرستادن پیشنهاد به سارا")}
</form>'''
FILES['Schedule.dc.html']=page('پیشنهاد جلسه',body)

# ---------- 3. Shared room (M2) ----------
def checkin(name,col,txt,mine):
    t=f'<p style="margin:0;font-size:13.5px;line-height:1.7">{txt}</p>' if txt else f'<p style="margin:0;font-size:13px;color:{MU}">هنوز ننوشته</p>'
    return f'<div style="{CARD};padding:12px;display:flex;flex-direction:column;gap:8px;{"border:2px solid "+PS if mine else ""}"><div style="display:flex;align-items:center;gap:8px">{av(name[0],col,26)}<b style="font-size:13px">{name}</b><span style="flex:1"></span><span style="font-size:11px;color:{MU}">قصدِ این جلسه</span></div>{t}</div>'
body=top('جلسه با سارا',True,f'<div style="display:flex;align-items:center;gap:4px" aria-label="حاضرها: تو و سارا">{av("ت","#6C5CE7",30)}<span style="width:9px;height:9px;border-radius:50%;background:{A};margin-inline-start:-10px;margin-top:20px;border:2px solid {BG}"></span>{av("س","#00A383",30)}<span style="width:9px;height:9px;border-radius:50%;background:{A};margin-inline-start:-10px;margin-top:20px;border:2px solid {BG}"></span></div>')+f'''
<main style="padding:6px 16px 24px;display:flex;flex-direction:column;gap:12px">
<div role="tablist" style="display:flex;gap:6px;background:#E9E9F2;border-radius:14px;padding:4px">
<button type="button" role="tab" aria-selected="true" style="flex:1;min-height:40px;border:0;border-radius:11px;background:#fff;font:inherit;font-weight:800;font-size:13px">تمرکز</button>
<button type="button" role="tab" aria-selected="false" style="flex:1;min-height:40px;border:0;border-radius:11px;background:transparent;font:inherit;font-weight:700;font-size:13px;color:{MU};display:flex;align-items:center;justify-content:center;gap:6px">{ic("video",16)} تصویر</button>
</div>
<section aria-label="زمان‌سنج مشترک" style="{CARD};text-align:center;padding:22px 16px">
<div style="font-size:12.5px;color:{AD};font-weight:800;display:flex;justify-content:center;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:{A}"></span>هر دو دارید کار می‌کنید</div>
<div dir="ltr" style="font-size:68px;font-weight:900;letter-spacing:1px;margin:6px 0 2px;font-variant-numeric:tabular-nums">۳۲:۱۴</div>
<div style="height:8px;border-radius:4px;background:#EFEFF6;overflow:hidden;margin:8px 10px 16px"><div style="width:36%;height:100%;background:{P};border-radius:4px"></div></div>
<div style="display:flex;justify-content:center;gap:12px">
<button type="button" aria-label="از اول" style="width:52px;height:52px;border-radius:50%;border:0;background:#EFEFF6;color:{INK};display:flex;align-items:center;justify-content:center">{ic("reset",22)}</button>
<button type="button" aria-label="مکث" style="width:64px;height:64px;border-radius:50%;border:0;background:{P};color:#fff;display:flex;align-items:center;justify-content:center">{ic("pause",26,"#fff",2.4)}</button>
<button type="button" aria-label="تمام کردن جلسه" style="width:52px;height:52px;border-radius:50%;border:0;background:{AS};color:{AD};display:flex;align-items:center;justify-content:center">{ic("check",22)}</button>
</div>
<div style="font-size:11.5px;color:{MU};margin-top:10px">۵۰ دقیقه · هر کدام از شما می‌تواند مکث کند</div>
</section>
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
{checkin("تو","#6C5CE7","فصل ۳ را تا آخر بخش روش بنویسم",True)}
{checkin("سارا","#00A383","",False)}
</div>
<section style="{CARD};display:flex;flex-direction:column;gap:10px">
<div style="display:flex;align-items:center;gap:6px;font-weight:800;font-size:14px">چک‌لیست من<span style="flex:1"></span><span style="font-size:11.5px;color:{MU};display:flex;align-items:center;gap:4px;font-weight:700">{ic("lock",14)} فقط تو می‌بینی</span></div>
<label style="display:flex;gap:10px;align-items:center;font-size:13.5px;min-height:32px"><input type="checkbox" checked style="width:20px;height:20px;accent-color:{P}"><span style="text-decoration:line-through;color:{MU}">جدول نمونه‌ها</span></label>
<label style="display:flex;gap:10px;align-items:center;font-size:13.5px;min-height:32px"><input type="checkbox" style="width:20px;height:20px;accent-color:{P}">پاراگراف ابزار پژوهش</label>
<label style="display:flex;gap:10px;align-items:center;font-size:13.5px;min-height:32px"><input type="checkbox" style="width:20px;height:20px;accent-color:{P}">منبع‌ها</label>
</section>
</main>'''
FILES['Room.dc.html']=page('اتاق مشترک جلسه',body)

# ---------- 4. Wrap-up sheet (M2) ----------
stars=''.join(f'<button type="button" aria-label="{n} ستاره" style="width:46px;height:46px;border:0;background:transparent;color:{"#F5A524" if n<=4 else "#C9C9D6"};display:flex;align-items:center;justify-content:center">'+ic("star",30,"currentColor",1.8).replace('fill="none"','fill="currentColor"' if n<=4 else 'fill="none"')+'</button>' for n in range(1,6))
body=f'''<div aria-hidden="true" style="position:absolute;inset:0;background:rgba(23,23,42,.45)"></div>
<div style="position:absolute;top:70px;left:16px;right:16px;opacity:.5;{CARD};text-align:center" aria-hidden="true"><div dir="ltr" style="font-size:52px;font-weight:900">۰۰:۰۰</div></div>
<section role="dialog" aria-label="جمع‌بندی جلسه" style="position:absolute;bottom:0;left:0;right:0;background:#fff;border-radius:24px 24px 0 0;padding:10px 18px 22px;display:flex;flex-direction:column;gap:14px">
<span aria-hidden="true" style="width:44px;height:5px;border-radius:3px;background:{LN};align-self:center"></span>
<div><h1 style="margin:0;font-size:19px;font-weight:900">جلسه تمام شد، خسته نباشی</h1><p style="margin:4px 0 0;font-size:13px;color:{MU}">۵۰ دقیقه با سارا · زنجیره‌ات شد ۵ هفته</p></div>
<label style="display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:800">چه کار کردی؟<textarea style="{inp};min-height:70px;padding:12px;resize:none">بخش روش را نوشتم، جدول نمونه‌ها تمام شد.</textarea></label>
<label style="display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:800">قدم بعدی<input value="منبع‌ها و پاراگراف ابزار" style="{inp}"></label>
<label style="display:flex;align-items:center;gap:12px;background:{PS};border-radius:14px;padding:12px;font-size:13.5px;font-weight:700"><input type="checkbox" checked style="width:22px;height:22px;accent-color:{P}">این جلسه هدف «پایان‌نامه» را جلو برد</label>
<div style="display:flex;flex-direction:column;gap:4px"><span style="font-size:13px;font-weight:800">همراهی با سارا چطور بود؟</span><div style="display:flex;gap:2px">{stars}</div>
<div style="display:flex;gap:6px;flex-wrap:wrap">{chip("سر وقت بود",True)}{chip("تمرکز خوب")}{chip("دوباره با هم")}</div></div>
{btn("ذخیره و پایان")}
<button type="button" style="min-height:44px;border:0;background:transparent;font:inherit;font-size:13px;color:{MU};display:flex;align-items:center;justify-content:center;gap:6px">{ic("flag",15)} گزارش یک مشکل</button>
</section>'''
FILES['Wrapup.dc.html']=page('جمع‌بندی جلسه',body)
# ---------- 5. Together hub (M4) ----------
def room_card(title,when,lang,n,host,col):
    return f'''<article style="{CARD};display:flex;flex-direction:column;gap:10px">
<div style="display:flex;align-items:center;gap:10px"><span style="width:44px;height:44px;border-radius:14px;background:{PS};color:{P};display:flex;align-items:center;justify-content:center">{ic("users",22)}</span>
<div style="flex:1;min-width:0"><div style="font-weight:800;font-size:14.5px">{title}</div><div style="font-size:12.5px;color:{MU};margin-top:2px">{when} · {lang}</div></div></div>
<div style="display:flex;align-items:center;gap:8px">{av(host[0],col,26)}<span style="font-size:12.5px;color:{MU};flex:1">میزبان: {host}</span>{chip(n,kind="g")}<a href="#" style="min-height:40px;padding:0 16px;border-radius:12px;background:{P};color:#fff;font-weight:800;font-size:13px;display:inline-flex;align-items:center;text-decoration:none">پیوستن</a></div></article>'''
def event_card(title,cat,date,place,left,cost,state):
    b={'join':f'<a href="EventDetail.dc.html" style="min-height:40px;padding:0 16px;border-radius:12px;background:{P};color:#fff;font-weight:800;font-size:13px;display:inline-flex;align-items:center;text-decoration:none">منم میام</a>',
       'sent':chip("درخواست فرستاده شد","g")}[state]
    return f'''<article style="{CARD};display:flex;flex-direction:column;gap:10px">
<div style="display:flex;gap:8px;align-items:center">{chip(cat,kind="a")}<span style="flex:1"></span><span style="font-size:11.5px;color:{AD};font-weight:800;display:flex;align-items:center;gap:4px">{ic("shield",14)} میزبان تأییدشده</span></div>
<a href="EventDetail.dc.html" style="font-weight:800;font-size:15px;color:{INK};text-decoration:none">{title}</a>
<div style="font-size:12.5px;color:{MU};display:flex;flex-direction:column;gap:4px"><span style="display:flex;gap:6px;align-items:center">{ic("cal",15)}{date}</span><span style="display:flex;gap:6px;align-items:center">{ic("pin",15)}{place}</span></div>
<div style="display:flex;align-items:center;gap:8px"><span style="font-size:12.5px;font-weight:800;color:#B4272C">{left}</span><span style="font-size:12.5px;color:{MU};flex:1">· {cost}</span>{b}</div></article>'''
body=top('جمع',False,f'<a href="Create.dc.html" aria-label="ساختن" style="min-height:44px;padding:0 14px;border-radius:14px;background:{P};color:#fff;display:inline-flex;align-items:center;gap:6px;font-weight:800;font-size:13px;text-decoration:none">{ic("plus",18)} بساز</a>')+f'''
<main style="padding:4px 16px 96px;display:flex;flex-direction:column;gap:10px">
<div role="tablist" style="display:flex;gap:6px;background:#E9E9F2;border-radius:14px;padding:4px">
<button type="button" role="tab" aria-selected="false" style="flex:1;min-height:40px;border:0;border-radius:11px;background:transparent;font:inherit;font-weight:700;font-size:13px;color:{MU}">اتاق‌های تمرکز</button>
<button type="button" role="tab" aria-selected="true" style="flex:1;min-height:40px;border:0;border-radius:11px;background:#fff;font:inherit;font-weight:800;font-size:13px">رویدادها</button>
</div>
<div style="display:flex;gap:6px;overflow:hidden">{chip("همه",True)}{chip("زبان")}{chip("ورزش")}{chip("کتاب")}{chip("کار با هم")}</div>
{event_card("کافه‌گفت‌وگوی هلندی-فارسی","زبان","شنبه ۳ آذر، ۱۴:۰۰","رتردام · کافه در مرکز شهر","۲ جای خالی","هر کس سهم خودش","join")}
{event_card("پیاده‌روی صبح جمعه کنار رود","ورزش","جمعه ۹ آذر، ۰۹:۳۰","رتردام · ساحل شمالی رود ماس","۵ جای خالی","رایگان","sent")}
<h2 style="{SEC}">اتاق‌های تمرکز همین حالا</h2>
{room_card("نوشتن پایان‌نامه، با هم ساکت","الان · تا ۱۹:۰۰","فارسی","۴/۸ نفر","مینا","#0984E3")}
</main>'''
FILES['Together.dc.html']=page('جمع — اتاق‌ها و رویدادها',body,navon='جمع')

# ---------- 6. Event detail (M4 + M5 safety card) ----------
mem=''.join(av(c,col,34) for c,col in [('م','#0984E3'),('س','#00A383'),('ن','#E17055'),('ل','#6C5CE7')])
body=top('رویداد',True,f'<button type="button" aria-label="بیشتر" style="width:44px;height:44px;border-radius:14px;background:#fff;border:0;color:{INK};display:inline-flex;align-items:center;justify-content:center">{ic("more",20)}</button>')+f'''
<main style="padding:6px 16px 24px;display:flex;flex-direction:column;gap:12px">
<section style="{CARD};display:flex;flex-direction:column;gap:10px">
<div style="display:flex;gap:8px">{chip("زبان",kind="a")}{chip("حضوری",kind="g")}</div>
<h2 style="margin:0;font-size:20px;font-weight:900">کافه‌گفت‌وگوی هلندی-فارسی</h2>
<p style="margin:0;font-size:13.5px;line-height:1.8;color:#3A3A52">هر کس نیم ساعت به زبانی که یاد می‌گیرد حرف می‌زند، بعد جا عوض می‌کنیم. سطح مهم نیست.</p>
<div style="display:flex;flex-direction:column;gap:8px;font-size:13.5px">
<span style="display:flex;gap:8px;align-items:center">{ic("cal",18,P)} شنبه ۳ آذر، ۱۴:۰۰ تا ۱۶:۰۰</span>
<span style="display:flex;gap:8px;align-items:center">{ic("pin",18,P)} رتردام · <span style="color:{MU}">جای دقیق بعد از تأیید میزبان</span></span>
<span style="display:flex;gap:8px;align-items:center">{ic("coffee",18,P)} هر کس سهم خودش</span>
</div></section>
<section style="{CARD};display:flex;align-items:center;gap:12px">{av("م","#0984E3",44)}<div style="flex:1"><div style="font-weight:800;font-size:14px">میزبان: مینا</div><div style="font-size:12px;color:{AD};font-weight:700;display:flex;gap:4px;align-items:center">{ic("shield",14)} هویت تأییدشده · ۷ رویداد برگزارشده</div></div></section>
<section style="{CARD}"><div style="display:flex;align-items:center;justify-content:space-between"><b style="font-size:14px">کی‌ها میان</b><span style="font-size:12.5px;color:{MU}">۶ از ۸ · ۲ جای خالی</span></div><div style="display:flex;gap:-6px;margin-top:10px">{mem}<span style="width:34px;height:34px;border-radius:50%;background:#EFEFF6;color:{MU};display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800">+۲</span></div></section>
<section aria-label="کارت ایمنی" style="background:{AS};border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:8px">
<div style="display:flex;align-items:center;gap:8px;font-weight:900;font-size:14px;color:{AD}">{ic("shield",20,AD)} پیش از رفتن</div>
<ul style="margin:0;padding-inline-start:18px;font-size:13px;line-height:1.9;color:#174D3F">
<li>جای عمومی است؛ آدرس خانه‌ات را به کسی نده.</li>
<li>یک ساعت بعد از شروع می‌پرسیم «همه‌چیز خوبه؟»</li>
<li>می‌توانی جای و زمان را با یک آدم مطمئن به اشتراک بگذاری.</li></ul>
<a href="Safety.dc.html" style="font-size:13px;font-weight:800;color:{AD}">قانون‌های همراه و نکته‌های ایمنی</a>
</section>
{btn("منم میام · درخواست به میزبان")}
</main>'''
FILES['EventDetail.dc.html']=page('جزئیات رویداد',body)

# ---------- 7. Create room/event (M4) ----------
body=top('ساختن در جمع')+f'''
<form style="padding:6px 16px 24px;display:flex;flex-direction:column;gap:18px">
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
<button type="button" aria-pressed="false" style="{CARD};border:2px solid {LN};font:inherit;text-align:start;display:flex;flex-direction:column;gap:6px;color:{INK}">{ic("users",24,P)}<b style="font-size:14px">اتاق تمرکز</b><span style="font-size:12px;color:{MU}">آنلاین، با هم ساکت کار کنید</span></button>
<button type="button" aria-pressed="true" style="{CARD};border:2px solid {P};background:{PS};font:inherit;text-align:start;display:flex;flex-direction:column;gap:6px;color:{INK}">{ic("cal",24,P)}<b style="font-size:14px">رویداد</b><span style="font-size:12px;color:{MU}">حضوری یا آنلاین، با تاریخ</span></button>
</div>
<label style="display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:800">عنوان<input value="کافه‌گفت‌وگوی هلندی-فارسی" style="{inp}"></label>
{row("دسته",f'<div style="display:flex;gap:8px;flex-wrap:wrap">{chipbtn("زبان",True)}{chipbtn("ورزش")}{chipbtn("کتاب")}{chipbtn("کار با هم")}{chipbtn("هنر")}</div>')}
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
<label style="display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:800">تاریخ<input value="شنبه ۳ آذر" style="{inp}"></label>
<label style="display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:800">ساعت<input value="۱۴:۰۰ تا ۱۶:۰۰" style="{inp}"></label></div>
<label style="display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:800">مکان<input value="کافه در مرکز رتردام" style="{inp}"><span style="font-weight:600;font-size:12px;color:{MU}">فقط برای کسانی که تأییدشان کنی دیده می‌شود.</span></label>
{row("ظرفیت",f'<div style="display:flex;align-items:center;gap:12px"><button type="button" aria-label="کم کن" style="width:44px;height:44px;border-radius:14px;border:2px solid {LN};background:#fff;font:inherit;font-size:20px">−</button><b style="font-size:18px;min-width:40px;text-align:center">۸</b><button type="button" aria-label="زیاد کن" style="width:44px;height:44px;border-radius:14px;border:2px solid {LN};background:#fff;font:inherit;font-size:20px">+</button><span style="font-size:12.5px;color:{MU}">نفر، با خودت</span></div>')}
<label style="display:flex;align-items:center;gap:12px;background:#fff;border-radius:14px;padding:12px;font-size:13.5px;font-weight:700"><input type="checkbox" checked style="width:22px;height:22px;accent-color:{P}">هر درخواست را خودم تأیید می‌کنم</label>
<div style="background:#FFF6E5;border-radius:14px;padding:12px;font-size:12.5px;line-height:1.8;color:#6B4A00;display:flex;gap:8px">{ic("shield",18,"#8A5A00")}<span>برای ساختن رویداد حضوری باید هویتت تأیید شده باشد. تو تأییدشده‌ای.</span></div>
{btn("ساختن رویداد")}
</form>'''
FILES['Create.dc.html']=page('ساختن اتاق یا رویداد',body)

# ---------- 8. Safety (M5) ----------
rules=[("۱۸+","فقط برای بزرگسال‌ها."),("کار با هم، نه قرار عاشقانه","همراه برای انجام کار و یادگیری با هم است."),("سر وقت بیا","اگر نمی‌رسی، زود لغو کن."),("جای عمومی","آدرس خانه‌ات را تا وقتی کسی را خوب نشناختی نده."),("بی‌احترامی ممنوع","آزار، نفرت، تبلیغ و درخواست پول بیرون از همراه ممنوع است."),("گزارش بده","هر گزارش را یک آدم می‌خواند.")]
rl=''.join(f'<li style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid {LN}"><span style="width:28px;height:28px;border-radius:50%;background:{PS};color:{P};font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;flex:none">{"۱۲۳۴۵۶"[k]}</span><span><b style="font-size:14px">{a}</b><br><span style="font-size:12.5px;color:{MU}">{b}</span></span></li>' for k,(a,b) in enumerate(rules))
body=top('ایمنی و قانون‌ها')+f'''
<main style="padding:6px 16px 24px;display:flex;flex-direction:column;gap:12px">
<section style="{CARD}"><ul style="list-style:none;margin:0;padding:0;margin-top:-10px">{rl}</ul></section>
<section style="{CARD};display:flex;flex-direction:column;gap:10px">
<b style="font-size:14px">آدم‌های مطمئن من</b>
<div style="display:flex;align-items:center;gap:10px">{av("ن","#636E72",36)}<span style="flex:1;font-size:13.5px">نیلوفر<br><span style="font-size:12px;color:{MU}">هر رویداد حضوری را خبردار می‌شود</span></span><span style="font-size:12px;font-weight:800;color:{AD}">روشن</span></div>
{btn("افزودن آدم مطمئن","g",True,"plus")}
</section>
<section style="background:{WS};border-radius:16px;padding:14px 16px;font-size:13px;line-height:1.8;color:#7A1F23">
<b>خطر فوری؟</b> همراه نمی‌تواند کمک بفرستد. در هلند و اروپا با <b dir="ltr">112</b> تماس بگیر.
</section>
<label style="display:flex;align-items:center;gap:12px;background:#fff;border-radius:14px;padding:12px;font-size:13.5px;font-weight:700"><input type="checkbox" checked style="width:22px;height:22px;accent-color:{P}">قانون‌ها را خواندم و می‌پذیرم</label>
</main>'''
FILES['Safety.dc.html']=page('ایمنی و قانون‌ها',body)
# ---------- 9. Outing: reminder + safety check-in (MO-2) ----------
body=top('شام جمعه با دخترا')+f'''
<main style="padding:6px 16px 24px;display:flex;flex-direction:column;gap:12px">
<section style="background:{P};color:#fff;border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:6px">
<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:800;opacity:.95">{ic("bell",16,"#fff")} یادآوری · فردا</div>
<div style="font-size:18px;font-weight:900">جمعه ۲ آذر، ۱۹:۳۰</div>
<div style="font-size:13px;display:flex;gap:6px;align-items:center">{ic("pin",16,"#fff")} رستوران در خیابان ویته‌دو‌ویتسترات</div>
<div style="display:flex;gap:8px;margin-top:8px"><button type="button" style="flex:1;min-height:44px;border:0;border-radius:12px;background:#fff;color:{P};font:inherit;font-weight:800;font-size:13px">میام</button><button type="button" style="flex:1;min-height:44px;border:0;border-radius:12px;background:rgba(255,255,255,.18);color:#fff;font:inherit;font-weight:800;font-size:13px">نمی‌رسم</button></div>
</section>
<section style="{CARD}"><b style="font-size:14px">۴ نفر میان</b><div style="display:flex;gap:6px;margin-top:10px">{av("س","#00A383",34)}{av("ن","#E17055",34)}{av("ل","#6C5CE7",34)}{av("م","#0984E3",34)}</div></section>
<section role="dialog" aria-label="بررسی ایمنی" style="{CARD};border:2px solid {A};display:flex;flex-direction:column;gap:10px">
<div style="display:flex;align-items:center;gap:8px;font-weight:900;font-size:15px">{ic("shield",20,AD)} همه‌چیز خوبه؟</div>
<p style="margin:0;font-size:13px;color:{MU};line-height:1.8">یک ساعت از شروع گذشته. جوابت را فقط تیم همراه می‌بیند.</p>
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">{btn("آره، خوبه","a")}{btn("یه مشکلی هست","d")}</div>
<span style="font-size:12px;color:{MU}">اگر تا ۳۰ دقیقه جواب ندهی، به آدم مطمئنت خبر می‌دهیم.</span>
</section>
</main>'''
FILES['OutReminder.dc.html']=page('بریم بیرون — یادآوری و بررسی ایمنی',body)

# ---------- 10. Outing: feedback after ----------
body=top('بعد از بیرون رفتن')+f'''
<main style="padding:6px 16px 24px;display:flex;flex-direction:column;gap:14px">
<div><h2 style="margin:0;font-size:19px;font-weight:900">شام جمعه چطور بود؟</h2><p style="margin:4px 0 0;font-size:13px;color:{MU}">جواب‌ها کمک می‌کند دفعهٔ بعد جای بهتری پیشنهاد بدهیم.</p></div>
<section style="{CARD};display:flex;flex-direction:column;gap:10px">
<b style="font-size:14px">خود جا</b>
<div style="display:flex;align-items:center;gap:10px"><span style="width:44px;height:44px;border-radius:14px;background:{PS};color:{P};display:flex;align-items:center;justify-content:center">{ic("pin",22)}</span><span style="flex:1;font-size:13.5px;font-weight:700">رستوران در ویته‌دو‌ویتسترات</span></div>
<div style="display:flex;gap:8px">{chipbtn("دوستش داشتم",True)}{chipbtn("معمولی")}{chipbtn("نه")}</div>
<label style="display:flex;align-items:center;gap:10px;font-size:13px"><input type="checkbox" checked style="width:20px;height:20px;accent-color:{P}">به «جاهایی که دوست دارم» در پروفایلم اضافه شود</label>
</section>
<section style="{CARD};display:flex;flex-direction:column;gap:10px">
<b style="font-size:14px">دوست داری دوباره با این‌ها بیرون بروی؟</b>
{"".join(f'<div style="display:flex;align-items:center;gap:10px">{av(n[0],c,34)}<span style="flex:1;font-size:13.5px;font-weight:700">{n}</span><button type="button" aria-label="دوباره با {n}" aria-pressed="{p}" style="width:44px;height:44px;border-radius:12px;border:2px solid {P if p=="true" else LN};background:{PS if p=="true" else "#fff"};color:{P if p=="true" else MU};display:flex;align-items:center;justify-content:center">{ic("heart",20)}</button></div>' for n,c,p in [("سارا","#00A383","true"),("نازنین","#E17055","true"),("لنا","#6C5CE7","false")])}
<span style="font-size:12px;color:{MU};display:flex;gap:6px;align-items:center">{ic("lock",14)} به کسی نشان داده نمی‌شود؛ فقط پیشنهادها را بهتر می‌کند.</span>
</section>
{btn("فرستادن")}
<button type="button" style="min-height:44px;border:0;background:transparent;font:inherit;font-size:13px;color:{MU};display:flex;align-items:center;justify-content:center;gap:6px">{ic("flag",15)} گزارش یک مشکل</button>
</main>'''
FILES['OutFeedback.dc.html']=page('بریم بیرون — نظر بعد از قرار',body)

# ---------- 11. Outing: recurring monthly ----------
months=''.join(f'<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid {LN}"><span style="width:44px;text-align:center"><b style="display:block;font-size:17px">{d}</b><span style="font-size:11px;color:{MU}">{m}</span></span><span style="flex:1;font-size:13px">{t}</span>{chip(s,kind=k)}</div>' for d,m,t,s,k in [("۲","آذر","جمعه، ۱۹:۳۰ · رستوران","قطعی","a"),("۷","دی","جمعه، ۱۹:۳۰ · جا هنوز نه","رأی‌گیری","p"),("۵","بهمن","جمعه، ۱۹:۳۰","بعداً","g")])
body=top('تکرار ماهانه')+f'''
<main style="padding:6px 16px 24px;display:flex;flex-direction:column;gap:14px">
<section style="{CARD};display:flex;flex-direction:column;gap:12px">
<div style="display:flex;align-items:center;gap:10px"><span style="width:44px;height:44px;border-radius:14px;background:{PS};color:{P};display:flex;align-items:center;justify-content:center">{ic("repeat",22)}</span><div style="flex:1"><b style="font-size:15px">شام جمعه با دخترا</b><div style="font-size:12.5px;color:{MU}">هر ماه، اولین جمعه</div></div></div>
{row("کی",f'<div style="display:flex;gap:8px;flex-wrap:wrap">{chipbtn("اولین جمعه",True)}{chipbtn("آخرین شنبه")}{chipbtn("هر دو هفته")}</div>')}
{row("جا",f'<div style="display:flex;gap:8px;flex-wrap:wrap">{chipbtn("هر بار رأی بدهیم",True)}{chipbtn("همیشه همین‌جا")}</div>')}
<span style="font-size:12.5px;color:{MU};line-height:1.8">یک هفته قبل از هر قرار، از همه می‌پرسیم میان یا نه و جا را رأی می‌دهیم. اگر کمتر از ۳ نفر بیایند، به تو خبر می‌دهیم.</span>
</section>
<section style="{CARD}"><b style="font-size:14px">قرارهای بعدی</b><div style="margin-top:6px">{months}</div></section>
{btn("ذخیرهٔ تکرار")}
</main>'''
FILES['OutRecurring.dc.html']=page('بریم بیرون — برنامهٔ ماهانه',body)

# ---------- write ----------
for k,v in FILES.items(): open(os.path.join(R,k),'w',encoding='utf-8').write(v)
rows=[['Main.dc.html','Schedule.dc.html','Room.dc.html','Wrapup.dc.html'],['Together.dc.html','EventDetail.dc.html','Create.dc.html','Safety.dc.html'],['OutReminder.dc.html','OutFeedback.dc.html','OutRecurring.dc.html']]
titles={'Main.dc.html':'جلسه‌ها — پیش رو (M1)','Schedule.dc.html':'پیشنهاد جلسه (M1)','Room.dc.html':'اتاق مشترک (M2)','Wrapup.dc.html':'جمع‌بندی و نظر (M2)','Together.dc.html':'جمع: رویدادها و اتاق‌ها (M4)','EventDetail.dc.html':'جزئیات رویداد + کارت ایمنی (M4/M5)','Create.dc.html':'ساختن رویداد (M4)','Safety.dc.html':'ایمنی و قانون‌ها (M5)','OutReminder.dc.html':'یادآوری و «همه‌چیز خوبه؟» (MO-2)','OutFeedback.dc.html':'نظر بعد از بیرون رفتن (MO-2)','OutRecurring.dc.html':'برنامهٔ ماهانه (MO-2)'}
boards={}; order=[]
rowtitles=['جلسه‌ها و اتاق مشترک — M1 و M2','جمع و ایمنی — M4 و M5','بریم بیرون، مرحلهٔ ۲ — MO-2']
notes={}
y=0
for ri,r in enumerate(rows):
    for ci,f in enumerate(r):
        boards[f]={'x':ci*(390+80),'y':y,'w':390,'h':844,'title':titles[f]}; order.append(f)
    notes[f'row{ri}']={'x':0,'y':y-240,'text':rowtitles[ri],'kind':'title1','maxW':4*390+3*80}
    y+=844+120+240
import datetime
canvas={'v':3,'createdOnFiles':{'v':1,'at':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')},'title':'همراه — طراحی صفحه‌های تازه','launch':{'view':'canvas'},'pages':[],'boards':boards,'order':order,'notes':notes,'designSystems':[]}
json.dump(canvas,open(os.path.join(R,'canvas.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(len(FILES))
