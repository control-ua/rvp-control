import { ukraineCities } from "./ukraine_cities.ts";

export const CUSTOMER_ADMIN_MENU = "👤 Замовники";
const OFFICE_SITE_SEARCH_PROMPT = "Введіть назву мережі латиницею (наприклад WOG) або код АЗК (наприклад 13).";
const SITE_FIELDS = "id,label,address,capacity_m3,site_key,passport_network,passport_city_code,passport_azk_code";
const CABINET = "Кабінет замовника";
const CONTACT = "Надіслати номер телефону";
const OBJECTS = "Мої об’єкти";
const ACTS = "Мої акти";
const COUNTER = "Лічильник РПВ";
const STATE = "customer_cabinet";
const LEGACY_PASSPORT_PREFIX = "customer_passport:";
const PASSPORT_PREFIX = "customer_passport_v2:";
const FILL_PASSPORT = "Заповнити паспорт об’єкта";
const CANCEL_PASSPORT = "Скасувати заповнення";
const PASSPORT_MENU = {keyboard:[[{text:CANCEL_PASSPORT}]],resize_keyboard:true};
const SEPTIC_VOLUMES = [10,15,20,25];
const NETWORK_NAME = /^[A-Za-z]{1,30}$/;
const AZK_CODE = /^\d{1,20}$/;
const OBLAST_CENTER_CODES = new Set([
  "UA05020030010063857", // Вінниця
  "UA12020010010037010", // Дніпро
  "UA14080030010048113", // Донецьк
  "UA18040190010057814", // Житомир
  "UA23060070010069526", // Запоріжжя
  "UA26040190010045761", // Івано-Франківськ
  "UA80000000000093317", // Київ
  "UA35040210010019355", // Кропивницький
  "UA44060010010012753", // Луганськ
  "UA07080170010083384", // Луцьк
  "UA46060250010015970", // Львів
  "UA48060150010035747", // Миколаїв
  "UA51100270010076757", // Одеса
  "UA53080370010073240", // Полтава
  "UA56060470010041018", // Рівне
  "UA59080270010036634", // Суми
  "UA61040490010069060", // Тернопіль
  "UA21100230010016545", // Ужгород
  "UA63120270010096107", // Харків
  "UA65100150010064384", // Херсон
  "UA68040470010096613", // Хмельницький
  "UA71080490010015879", // Черкаси
  "UA73060610010033137", // Чернівці
  "UA74100390010054825", // Чернігів
]);
const OBLAST_CENTERS = ukraineCities.filter(city => OBLAST_CENTER_CODES.has(city[0]))
  .sort((a,b) => a[1].localeCompare(b[1],"uk"));
const CITY_BY_CODE = new Map(ukraineCities.map(city => [city[0],city]));
const PAGE = 8;
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const KEY = /^[a-z0-9_-]{1,50}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const MONTH_NAMES = ["Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"];
const CONTACT_MENU = {keyboard:[[{text:CONTACT,request_contact:true}]],resize_keyboard:true,one_time_keyboard:true};
const MENU = {keyboard:[[{text:OBJECTS},{text:ACTS}],[{text:COUNTER}],[{text:"🌐 Відкрити вебкабінет"}]],resize_keyboard:true,is_persistent:true};
const COMMANDS = new Set(["/rpv_help","/rpv_revoke","/rpv_act"]);

const kyivDate = () => new Intl.DateTimeFormat("sv-SE", {timeZone:"Europe/Kyiv", year:"numeric", month:"2-digit",day:"2-digit"}).format(new Date());
const monthLabel = (month: string) => `${MONTH_NAMES[Number(month.slice(5,7))-1]} ${month.slice(0,4)}`;
const amount = (value: number | string) => Number(value).toLocaleString("uk-UA",{maximumFractionDigits:3});
const displayDate = (value: string) => value.slice(0,10).split("-").reverse().join(".");
const button = (text: string, callback_data: string) => ({text,callback_data});
const shorten = (value: string) => Array.from(value).slice(0,52).join("");

function displaySiteCode(label: string, siteKey: string): string | null {
  const title = label.trim();
  const markedCode = title.match(/(?:№|#)\s*(\d{1,20}[\p{L}]?)(?![\p{L}\p{N}])/u)?.[1];
  if (markedCode) return markedCode;
  const trailingCode = title.match(/(?:^|[\s-])(\d{1,20}[\p{L}]?)$/u)?.[1];
  if (trailingCode && (title === trailingCode || /^(?:азк|азс)(?![\p{L}\p{N}])/iu.test(title))) {
    return trailingCode;
  }
  return siteKey.startsWith("self-") ? null : siteKey;
}

type SitePassport = {
  id: string;
  label: string;
  address: string;
  capacity_m3: number | null;
  site_key: string;
  passport_network: string | null;
  passport_city_code: string | null;
  passport_azk_code: string | null;
};

function sitePassportLines(row: SitePassport) {
  const lines = [row.label];
  const city = row.passport_city_code ? CITY_BY_CODE.get(row.passport_city_code) : null;
  if (row.passport_network) lines.push(`Мережа: ${row.passport_network}`);
  if (city) lines.push(`Регіон: ${cityText(city)}`);
  const code = row.passport_azk_code ?? displaySiteCode(row.label,row.site_key);
  if (code) lines.push(`Код об’єкта: ${code}`);
  lines.push(`Адреса: ${row.address}`);
  if (row.capacity_m3 != null) lines.push(`Ємність септика за паспортом — ${amount(row.capacity_m3)} м³`);
  return lines;
}

type PassportDraft = {
  id: string;
  network?: string;
  city?: string;
  azkCode?: string;
  address?: string;
  cityQuery?: string;
};

const encodeDraft = (draft: PassportDraft) => PASSPORT_PREFIX + JSON.stringify(draft);
const normalizeCitySearch = (value: string) => value.toLocaleLowerCase("uk").replace(/['’ʼ]/g,"");
const cityText = (city: (typeof ukraineCities)[number]) => `${city[1]} · ${city[2]}`;

type Options = {
  db: any;
  telegram: (method: string, body: Record<string, unknown>) => Promise<any>;
  getSession: (id: number) => Promise<any>;
  setSession: (id: number, state: string) => Promise<boolean>;
  clearSession: (id: number) => Promise<unknown>;
  adminMenu: () => unknown;
  refreshAdmins: () => Promise<void>;
  adminIds: () => number[];
  isAdmin: (id: number) => boolean;
  rateLimit: (id: number) => Promise<boolean>;
};

export function makeCustomerCabinet(o: Options) {
  const db = o.db;
  async function send(id: number, text: string, keyboard?: unknown) {
    return await o.telegram("sendMessage",{chat_id:id,text,...(keyboard ? {reply_markup:keyboard} : {})});
  }

  function requireData(result: any) {
    if (result.error) throw new Error(result.error.code || "customer cabinet database request");
    return result.data;
  }

  async function profile(id: number) {
    return requireData(await db.from("customers").select("status,phone").eq("telegram_id",id).maybeSingle());
  }

  async function hasAccess(id: number) {
    const rows = requireData(await db.from("rpv_customer_visible_sites").select("id").eq("telegram_id",id).limit(1));
    return rows.length > 0;
  }

  async function openCabinet(id: number) {
    const user = await profile(id);
    if (!user?.phone) return await send(id,"Для входу до кабінету надішліть свій номер телефону.",CONTACT_MENU);
    if (user.status === "active") {
      if (await hasAccess(id)) return await send(id,"Кабінет замовника",MENU);
      return await send(id,"Контакт підтверджено. Заповніть паспорт свого об’єкта, щоб продовжити.",{
        keyboard:[[{text:FILL_PASSPORT}]],resize_keyboard:true,
      });
    }
    const status = user.status === "rejected"
      ? "Офіс відхилив запит на підтвердження контакту. Зверніться до офісу, щоб уточнити причину."
      : "Очікуємо підтвердження контакту від офісу.";
    return await send(id,status,{remove_keyboard:true});
  }

  async function register(id: number, user: any, contact: any) {
    const existing = await profile(id);
    if (existing && (existing.phone || existing.status !== "pending")) return await openCabinet(id);
    const phone = String(contact.phone_number || "").trim();
    if (contact.user_id !== id || !/^\+?[1-9]\d{6,14}$/.test(phone)) {
      return await send(id,"Надішліть власний номер кнопкою нижче.",CONTACT_MENU);
    }
    const normalized = phone.startsWith("+") ? phone : `+${phone}`;
    const values = {phone:normalized, first_name:user.first_name || null,
      last_name:user.last_name || null, username:user.username || null};
    const inserted = existing
      ? requireData(await db.from("customers").update({...values,updated_at:new Date().toISOString()})
          .eq("telegram_id",id).eq("status","pending").is("phone",null).select("telegram_id"))
      : requireData(await db.from("customers").upsert({
          ...values, telegram_id:id, status:"pending",
        },{onConflict:"telegram_id",ignoreDuplicates:true}).select("telegram_id"));
    if (inserted.length) {
      await o.refreshAdmins();
      const name = [user.first_name,user.last_name].filter(Boolean).join(" ");
      await Promise.all(o.adminIds().map(admin => send(admin,
        `Запит на доступ до кабінету замовника\n${name}\n${normalized}\nTelegram ID ${id}`,
        {inline_keyboard:[[button("Переглянути запит",`rpvo:u:${id}`)]]})));
    }
    return await openCabinet(id);
  }

  async function startPassport(id: number) {
    const user = await profile(id);
    if (user?.status !== "active" || !user.phone) return await openCabinet(id);
    const draft = {id:crypto.randomUUID().replaceAll("-","")};
    if (!(await o.setSession(id,encodeDraft(draft)))) {
      return await send(id,"Не вдалося відкрити форму. Спробуйте ще раз.");
    }
    return await showPassportStep(id,draft);
  }

  async function advancePassport(id: number, state: string, next: PassportDraft) {
    const rows = requireData(await db.from("bot_sessions")
      .update({state:encodeDraft(next),updated_at:new Date().toISOString()})
      .eq("telegram_id",id).eq("state",state).select("telegram_id"));
    if (rows.length) return await showPassportStep(id,next);
  }

  async function showPassportStep(id: number, draft: PassportDraft) {
    if (!draft.network) return await send(id,"1/5. Мережа. Введіть назву одним словом латиницею, наприклад UPG.",PASSPORT_MENU);
    if (!draft.city) {
      const query = draft.cityQuery ?? "";
      const centers = query
        ? OBLAST_CENTERS.filter(city => normalizeCitySearch(city[1]).includes(query))
        : OBLAST_CENTERS;
      const rows: ReturnType<typeof button>[][] = [];
      for (let i=0; i<centers.length; i+=2) {
        rows.push(centers.slice(i,i+2).map(city =>
          button(city[1],`rpvc:ct:${draft.id}:${city[0]}`)
        ));
      }
      if (query) rows.push([button("Усі обласні центри",`rpvc:cl:${draft.id}`)]);
      const prompt = "2/5. Регіон. Оберіть обласний центр або введіть кілька літер для пошуку.";
      return await send(id,centers.length ? prompt : `${prompt}\nЗа цим запитом обласних центрів не знайдено.`,
        {inline_keyboard:rows});
    }
    if (!draft.azkCode) return await send(id,"3/5. Код АЗК. Введіть лише цифри, наприклад 9090.",PASSPORT_MENU);
    if (!draft.address) {
      const city = CITY_BY_CODE.get(draft.city);
      return await send(id,`4/5. Локація. Введіть повну адресу АЗК: населений пункт, вулицю та номер будинку або номер кілометра траси.${city ? `\nОбраний обласний центр: ${city[1]}.` : ""}`,PASSPORT_MENU);
    }
    return await send(id,"5/5. Об’єм септика. Оберіть значення:",{inline_keyboard:[
      SEPTIC_VOLUMES.map(volume => button(`${volume} м³`,`rpvc:cv:${draft.id}:${volume}`)),
    ]});
  }

  async function handlePassport(id: number, state: string, draft: PassportDraft, text: string, action: string) {
    if (action) {
      const [,kind,token,value] = action.split(":");
      if (token !== draft.id) return;
      if (draft.network && !draft.city) {
        if (kind === "cl") return await advancePassport(id,state,{...draft,cityQuery:undefined});
        if (kind === "ct" && OBLAST_CENTER_CODES.has(value)) {
          return await advancePassport(id,state,{...draft,city:value,cityQuery:undefined});
        }
        if (kind === "cp" || kind === "ct") return await showPassportStep(id,draft);
      }
      if (kind === "cv" && draft.address && draft.azkCode && draft.city && draft.network &&
          SEPTIC_VOLUMES.some(volume => String(volume) === value)) {
        const key = requireData(await db.rpc("rpv_customer_save_passport_v2",{
          p_user:id,p_state:state,p_capacity:Number(value),
        }));
        if (!key) return await openCabinet(id);
        return await send(id,`Паспорт збережено. Код АЗК: ${draft.azkCode}\nПереглянути паспорт можна в розділі «Мої об’єкти».`,MENU);
      }
      return;
    }

    if (!draft.network && NETWORK_NAME.test(text)) {
      return await advancePassport(id,state,{...draft,network:text.toUpperCase()});
    }
    if (draft.network && !draft.city && /^[\p{L}'’ʼ -]{1,60}$/u.test(text)) {
      return await advancePassport(id,state,{...draft,cityQuery:normalizeCitySearch(text)});
    }
    if (draft.city && !draft.azkCode && AZK_CODE.test(text)) {
      return await advancePassport(id,state,{...draft,azkCode:text});
    }
    if (draft.azkCode && !draft.address && text.length >= 5 && text.length <= 350 && /\p{L}/u.test(text)) {
      return await advancePassport(id,state,{...draft,address:text.replace(/\s+/g," ")});
    }
    return await showPassportStep(id,draft);
  }

  async function listSites(id: number, page = 0) {
    const rows = requireData(await db.from("rpv_customer_visible_sites").select("id,label,site_key,passport_azk_code")
      .eq("telegram_id",id).order("label").order("id").range(page*PAGE,page*PAGE+PAGE));
    const list = rows.slice(0,PAGE).map((row: any) => [
      button(row.passport_azk_code ?? displaySiteCode(row.label,row.site_key) ?? "Код не вказано",`rpvc:s:${row.id}`),
    ]);
    list.push([button("➕ Додати об’єкт","rpvc:new")]);
    await paged(id, "Мої об’єкти", list, page, rows.length > PAGE, "sp");
  }

  async function listActs(id: number, page = 0, month?: string) {
    let query = db.from("rpv_customer_visible_acts").select("act_id,site_label,act_number,work_date")
      .eq("telegram_id",id);
    if (month) {
      const [year,m] = month.split("-").map(Number);
      const next = m === 12 ? `${year+1}-01` : `${year}-${String(m+1).padStart(2,"0")}`;
      query = query.gte("work_date",month+"-01").lt("work_date",next+"-01");
    }
    const rows = requireData(await query.order("work_date",{ascending:false}).order("act_id").range(page*PAGE,page*PAGE+PAGE));
    const list = rows.slice(0,PAGE).map((row: any) => [
      button(shorten(`${displayDate(row.work_date)} · ${row.site_label} · ${row.act_number}`),`rpvc:a:${row.act_id}`),
    ]);
    await paged(id, month ? `Акти · ${monthLabel(month)}` : "Мої акти", list, page,
      rows.length > PAGE, month ? `ap:${month}` : "ap");
  }

  async function paged(id: number, title: string, rows: any[], page: number, more: boolean, key: string) {
    const nav = [];
    if (page) nav.push(button("‹ Назад",`rpvc:${key}:${page-1}`));
    if (more) nav.push(button("Далі ›",`rpvc:${key}:${page+1}`));
    if (nav.length) rows.push(nav);
    await send(id,rows.length ? title : `${title}\nЗаписів поки немає.`,rows.length ? {inline_keyboard:rows} : MENU);
  }

  async function showSite(id: number, site: string) {
    const row = requireData(await db.from("rpv_customer_visible_sites").select(SITE_FIELDS)
      .eq("telegram_id",id).eq("id",site).maybeSingle());
    if (!row) return await send(id,"Об’єкт недоступний.",MENU);
    const recent = requireData(await db.from("rpv_customer_visible_acts").select("work_date")
      .eq("telegram_id",id).eq("site_id",site).not("pumped_m3","is",null)
      .order("work_date",{ascending:false}).limit(1).maybeSingle());
    const lines = sitePassportLines(row);
    if (recent) lines.push(`Остання підтверджена відкачка — ${displayDate(recent.work_date)}`);
    await send(id,lines.join("\n"),MENU);
  }

  async function showAct(id: number, act: string) {
    const row = requireData(await db.from("rpv_customer_visible_acts").select("*")
      .eq("telegram_id",id).eq("act_id",act).maybeSingle());
    if (!row) return await send(id,"Акт недоступний.",MENU);
    const doc = requireData(await db.from("acts").select("telegram_file_id,file_type").eq("id",act).eq("status","approved").maybeSingle());
    if (!doc?.telegram_file_id) return await send(id,"Файл акта недоступний.",MENU);
    const caption = `${row.act_number} · ${row.site_label}\n${displayDate(row.work_date)} · Заявка № ${row.application_number || "—"}` +
      (row.pumped_m3 == null ? "" : `\nВідкачано ${amount(row.pumped_m3)} м³`);
    const photo = doc.file_type === "photo";
    const reply = await o.telegram(photo ? "sendPhoto" : "sendDocument",{
      chat_id:id,[photo ? "photo" : "document"]:doc.telegram_file_id,caption,protect_content:true,
    });
    if (!reply?.ok) await send(id,"Не вдалося відкрити файл акта.",MENU);
  }

  async function total(id: number, month: string) {
    return requireData(await db.rpc("rpv_customer_total",{p_user:id,p_month:month+"-01"}));
  }

  async function showCounter(id: number, month = kyivDate().slice(0,7)) {
    const current = kyivDate().slice(0,7);
    if (month > current) return;
    await send(id,`${monthLabel(month)} — ${amount(await total(id,month))} м³`,{inline_keyboard:[
      month === current ? [button("Архів","rpvc:archive:0")] : [button("Заявки за місяць",`rpvc:ap:${month}:0`),button("Архів","rpvc:archive:0")],
    ]});
  }

  async function showArchive(id: number, page: number) {
    const rows = requireData(await db.rpc("rpv_customer_months",{p_user:id,p_before:kyivDate().slice(0,7)+"-01",p_offset:page*PAGE}));
    const list = rows.slice(0,PAGE).map((row: any) => {
      const month = row.month_start.slice(0,7);
      return [button(monthLabel(month),`rpvc:month:${month}`)];
    });
    await paged(id,"Архів",list,page,rows.length > PAGE,"archive");
  }

  async function notify(id: number, row: any) {
    const recipients = db.from("rpv_customer_visible_acts").select("telegram_id")
      .eq("act_id",row.act_id).order("telegram_id");
    let sent = 0;
    let failed = 0;
    for (let from=0; ; from+=100) {
      const users = requireData(await recipients.range(from,from+99));
      for (const user of users) {
        const chat = Number(user.telegram_id);
        const current = requireData(await db.from("rpv_customer_visible_acts").select("act_id")
          .eq("telegram_id",chat).eq("act_id",row.act_id).maybeSingle());
        if (!current) continue;
        const claim = requireData(await db.from("rpv_customer_delivery").upsert({
          act_id:row.act_id,telegram_id:chat,
        },{onConflict:"act_id,telegram_id",ignoreDuplicates:true}).select("telegram_id"));
        if (!claim.length) continue;
        const month = row.work_date.slice(0,7);
        const result = await send(chat,`${displayDate(row.work_date)} · Заявка № ${row.application_number || "—"} · Відкачано ${amount(row.pumped_m3)} м³\n${monthLabel(month)} — ${amount(await total(chat,month))} м³`);
        if (result?.ok) sent++;
        else {
          failed++;
          if (result?.ok === false && result.error_code) {
            requireData(await db.from("rpv_customer_delivery").delete().eq("act_id",row.act_id).eq("telegram_id",chat));
          }
        }
      }
      if (users.length < 100) break;
    }
    await send(id,`Акт опубліковано. Сповіщень надіслано — ${sent}.${failed ? ` Не підтверджено доставку — ${failed}.` : ""}`);
  }

  function officeButton(label: string, action: string) {
    return button(label, `rpvo:${action}`);
  }

  async function officePage(id: number, text: string, rows: ReturnType<typeof button>[][], page: number, action: string, more: boolean, back: string) {
    const navigation = [];
    if (page > 0) navigation.push(officeButton("⬅️", `${action}:${page - 1}`));
    if (more) navigation.push(officeButton("➡️", `${action}:${page + 1}`));
    if (navigation.length) rows.push(navigation);
    rows.push([officeButton("↩️ Назад", back)]);
    await send(id,text,{inline_keyboard:rows});
  }

  async function officeSiteSearchPrompt(id: number) {
    return await send(id,OFFICE_SITE_SEARCH_PROMPT,{force_reply:true,input_field_placeholder:"Мережа або код АЗК"});
  }

  async function officeSiteList(id: number, kind: "find" | "customer", value: string, page: number) {
    const byCustomer = kind === "customer";
    let query = db.from(byCustomer ? "rpv_customer_visible_sites" : "rpv_customer_sites").select(SITE_FIELDS);
    if (byCustomer) {
      query = query.eq("telegram_id",Number(value));
    } else if (AZK_CODE.test(value)) {
      const legacyCode = `(^${value}$|^АЗ[КС]([[:space:]-]+[[:alpha:]][[:alnum:]_-]*)*[[:space:]№#-]+${value}$|[№#][[:space:]]*${value}([^[:alnum:]]|$))`;
      query = query.or(`passport_azk_code.eq.${value},and(passport_azk_code.is.null,or(site_key.eq.${value},label.imatch."${legacyCode}"))`);
    } else if (NETWORK_NAME.test(value)) {
      const legacyNetwork = `^АЗ[КС][[:space:]]+${value}([[:space:]№#-]|$)`;
      query = query.or(`passport_network.ilike.${value},and(passport_network.is.null,or(network_key.ilike.${value},label.imatch."${legacyNetwork}"))`);
    } else {
      return await officeSiteSearchPrompt(id);
    }
    const results = requireData(await query.order("label").order("id").range(page*PAGE,page*PAGE+PAGE)) as SitePassport[];
    const rows = results.slice(0,PAGE).map(row => [
      officeButton(shorten(`${row.label} · ${row.address}`),`site:${row.id}`),
    ]);
    if (!byCustomer) rows.push([officeButton("🔎 Новий пошук","find")]);
    const title = byCustomer ? "Паспорти АЗК замовника" : `Результати пошуку АЗК · ${value}`;
    const action = byCustomer ? `sites:${value}` : `find:${value}`;
    return await officePage(id,results.length ? title : `${title}\nОб’єктів не знайдено.`,rows,page,
      action,results.length>PAGE,byCustomer ? `u:${value}` : "home");
  }

  async function siteRegistrant(siteKey: string) {
    // Customer-created passports receive a single direct site grant at registration.
    if (!siteKey.startsWith("self-")) return null;
    const grants = requireData(await db.from("rpv_customer_access")
      .select("customers(first_name,last_name,username,phone,status)")
      .eq("scope_kind","site").eq("scope_key",siteKey).limit(2));
    if (grants.length !== 1) return null;
    const contact = grants[0].customers;
    return contact?.status === "active" && /^\+[1-9]\d{6,14}$/.test(contact.phone ?? "") ? contact : null;
  }

  async function officeSiteCard(id: number, site: string, call: boolean) {
    const row = requireData(await db.from("rpv_customer_sites").select(SITE_FIELDS).eq("id",site).maybeSingle());
    const back = [officeButton("🔎 Новий пошук","find"),officeButton("↩️ Замовники","home")];
    if (!row) return await send(id,"Об’єкт не знайдено.",{inline_keyboard:[back]});
    const contact = await siteRegistrant(row.site_key);
    if (call) {
      if (!contact) return await send(id,"Підтверджений контакт для цього АЗК недоступний.");
      const intro = `📞 ${officeCustomerName(contact)}\nНатисніть номер, щоб зателефонувати:\n`;
      return await o.telegram("sendMessage",{
        chat_id:id,text:intro+contact.phone,
        entities:[{type:"phone_number",offset:intro.length,length:contact.phone.length}],
      });
    }

    const lines = sitePassportLines(row);
    if (!contact) return await send(id,lines.join("\n"),{inline_keyboard:[back]});
    const username = typeof contact.username === "string" ? contact.username : "";
    const telegramTarget = /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username) ? username : contact.phone;
    lines.push(`Контакт: ${officeCustomerName(contact)}`,`Телефон: ${contact.phone}`);
    return await send(id,lines.join("\n"),{inline_keyboard:[
      [officeButton("📞 Зателефонувати",`call:${row.id}`),
        {text:"💬 Написати в Telegram",url:`https://t.me/${telegramTarget}`}],
      back,
    ]});
  }

  async function decideContact(id: number, user: number, approve: boolean, version: string) {
    const changed = requireData(await db.from("customers")
      .update({status:approve ? "active" : "rejected",updated_at:new Date().toISOString()})
      .eq("telegram_id",user).eq("status","pending").eq("updated_at",version)
      .not("phone","is",null).select("telegram_id"));
    const back = {inline_keyboard:[[officeButton("До списку запитів","p:0")]]};
    if (!changed.length) return await send(id,"Запит уже оброблено або не знайдено.",back);
    const result = approve
      ? await send(user,"Офіс підтвердив ваш контакт. Продовжіть реєстрацію та заповніть паспорт об’єкта.",{
          inline_keyboard:[[button("Продовжити реєстрацію","rpvc:continue")]],
        })
      : await send(user,"Офіс відхилив запит на підтвердження контакту. Зверніться до офісу, щоб уточнити причину.");
    const status = approve ? "Контакт підтверджено." : "Контакт відхилено.";
    return await send(id,status + (result?.ok ? "" : " Сповіщення замовнику не доставлено."),back);
  }

  async function officeMenu(id: number, action = "home") {
    const [kind,value,...versionParts] = action.split(":");
    const version = versionParts.join(":");
    const validVersion = version.length <= 35 && /^\d{4}-\d{2}-\d{2}T/.test(version) && Number.isFinite(Date.parse(version));
    const user = Number(value);
    const validUser = Number.isSafeInteger(user) && user > 0;
    if (kind === "home") {
      return await send(id,"👤 Замовники · підтвердження контактів",{
        inline_keyboard:[
          [officeButton("⏳ Запити на доступ","p:0"),officeButton("✅ Підтверджені","a:0")],
          [officeButton("🔎 Пошук АЗК","find")],
          [officeButton("❌ Відхилені","r:0")],
          [officeButton("↩️ Адмін-панель","close")],
        ],
      });
    }
    if (kind === "close") return await send(id,"👑 Адмін-панель",o.adminMenu());
    if (kind === "find") {
      if (!value) return await officeSiteSearchPrompt(id);
      if (/^\d{1,5}$/.test(version)) return await officeSiteList(id,"find",value,Number(version));
      return;
    }
    if ((kind === "site" || kind === "call") && UUID.test(value)) {
      return await officeSiteCard(id,value,kind === "call");
    }
    if (kind === "sites" && validUser && /^\d{1,5}$/.test(version)) {
      return await officeSiteList(id,"customer",value,Number(version));
    }
    if (kind === "p" || kind === "a" || kind === "r") {
      if (!/^\d{1,5}$/.test(value ?? "")) return;
      const page = Number(value);
      const rows = requireData(await db.from("customers")
        .select("telegram_id,first_name,last_name,username,phone")
        .eq("status",kind === "p" ? "pending" : kind === "a" ? "active" : "rejected").not("phone","is",null)
        .order("updated_at",{ascending:false}).order("telegram_id").range(page*PAGE,page*PAGE+PAGE));
      const buttons = rows.slice(0,PAGE).map((row: any) => [
        officeButton(shorten(`${officeCustomerName(row)} · ${row.phone}`),`u:${row.telegram_id}`),
      ]);
      const title = kind === "p" ? "Контакти на підтвердження" :
        kind === "a" ? "Підтверджені контакти" : "Відхилені контакти";
      return await officePage(id,rows.length ? title : `${title} · список порожній`,buttons,page,kind,rows.length > PAGE,"home");
    }
    if (!validUser) return;
    if ((kind === "approve" || kind === "reject") && validVersion) {
      return await decideContact(id,user,kind === "approve",version);
    }
    if (kind === "xd" && validVersion) {
      const changed = requireData(await db.rpc("rpv_customer_reset_registration",{
        p_user:user,p_version:version,
      }));
      const text = changed ? "Реєстрацію скинуто. Замовник може відкрити бота й зареєструватися заново." :
        "Реєстрація вже змінилася. Відкрийте актуальну картку замовника.";
      return await send(id,text,{inline_keyboard:[[officeButton("До розділу «Замовники»","home")]]});
    }
    if (kind === "u" || kind === "x") {
      const row = requireData(await db.from("customers")
        .select("first_name,last_name,username,phone,status,updated_at").eq("telegram_id",user).maybeSingle());
      if (!row?.phone) return await send(id,"Запит не знайдено.");
      if (kind === "x") {
        if (version !== row.updated_at) {
          return await send(id,"Картка застаріла. Відкрийте її ще раз.",{
            inline_keyboard:[[officeButton("Картка замовника",`u:${user}`)]],
          });
        }
        return await send(id,`Скинути реєстрацію замовника ${officeCustomerName(row)} (${row.phone})?\nЗамовник втратить доступ до кабінету й зможе подати нову заявку. Паспорти та акти залишаться в базі.`,{
          inline_keyboard:[
            [officeButton("Підтвердити видалення",`xd:${user}:${row.updated_at}`)],
            [officeButton("Скасувати",`u:${user}`)],
          ],
        });
      }
      const pending = row.status === "pending";
      const title = pending ? "Запит на підтвердження контакту" :
        row.status === "active" ? "Контакт підтверджено" : "Контакт відхилено";
      const rows = pending ? [[
        officeButton("✅ Підтвердити контакт",`approve:${user}:${row.updated_at}`),
        officeButton("❌ Відхилити контакт",`reject:${user}:${row.updated_at}`),
      ]] : [];
      if (row.status === "active") rows.push([officeButton("🏢 Паспорти АЗК",`sites:${user}:0`)]);
      rows.push(
        [officeButton("🗑 Видалити замовника",`x:${user}:${row.updated_at}`)],
        [officeButton("↩️ До списку",pending ? "p:0" : row.status === "active" ? "a:0" : "r:0")],
      );
      return await send(id,`${title}\n${officeCustomerName(row)}\n${row.phone}\nTelegram ID ${user}`,{inline_keyboard:rows});
    }
    return await send(id,"Відкрийте актуальну картку замовника зі списку запитів.",{
      inline_keyboard:[[officeButton("До списку запитів","p:0")]],
    });
  }

  function officeCustomerName(row: any) {
    return [row.first_name,row.last_name].filter(Boolean).join(" ") ||
      (row.username ? `@${row.username}` : "Без імені");
  }

  async function admin(id: number, command: string, args: string) {
    await o.refreshAdmins();
    if (!o.isAdmin(id)) return;
    const [arg1,arg2,arg3,arg4] = args.trim().split(/\s+/);
    if (command === "/rpv_revoke") {
      const user = Number(arg1);
      const scopeValid = (arg2 === "site" || arg2 === "network") ? KEY.test(arg3 ?? "") :
        arg2 === "region" && (arg3 ?? "").split("/").length===2 && arg3.split("/").every(part=>KEY.test(part));
      if (!Number.isSafeInteger(user) || user<=0 || !scopeValid || arg4) {
        return await send(id,"Формат: /rpv_revoke Telegram_ID тип код.");
      }
      requireData(await db.from("rpv_customer_access").delete().eq("telegram_id",user).eq("scope_kind",arg2).eq("scope_key",arg3));
      return await send(id,"Доступ за вказаним правилом відкликано.");
    }
    if (command === "/rpv_act") {
      const volume = arg4 === "-" ? null : Number((arg4 ?? "").replace(",","."));
      if (!/^[\w-]{1,70}$/.test(arg1 ?? "") || !KEY.test(arg2 ?? "") || !DAY.test(arg3 ?? "") ||
          arg3 > kyivDate() || (volume!==null && (!Number.isFinite(volume) || volume<=0 || volume>=1000000)) || args.trim().split(/\s+/).length!==4) {
        return await send(id,"Формат: /rpv_act номер_акта код_об’єкта РРРР-ММ-ДД обсяг. Для робіт без відкачки вкажіть - замість обсягу.");
      }
      const row = requireData(await db.rpc("rpv_customer_publish",{p_act:arg1,p_site:arg2,p_date:arg3,p_volume:volume}))[0];
      if (!row) return await send(id,"Перевірте номер підтвердженого акта, код об’єкта та збіг адреси заявки з паспортом. Якщо заявку вже опубліковано з іншими даними, потрібна перевірка офісу.");
      if (row.pumped_m3 !== null && row.work_date.slice(0,7)===kyivDate().slice(0,7)) return await notify(id,row);
      return await send(id,"Акт опубліковано.");
    }
    await send(id,"Кабінет замовника · команди офісу\n\n/rpv_revoke Telegram_ID тип код\n/rpv_act номер_акта код_об’єкта РРРР-ММ-ДД обсяг");
  }

  async function handle(update: any, verified: boolean) {
    const callback = update?.callback_query;
    const message = callback?.message ?? update?.message;
    const user = callback?.from ?? message?.from;
    if (message?.chat?.type !== "private" || !user?.id || message.chat.id !== user.id) return false;
    const id = user.id;
    const text = callback ? "" : String(message.text || "").trim();
    const command = text.split(/\s+/,1)[0];
    const args = text.slice(command.length).trim();
    const office = COMMANDS.has(command);
    const action = String(callback?.data ?? "");
    const cabinetAction = action.startsWith("rpvc:");
    const officeSearchReply = !callback && !!text && message.reply_to_message?.from?.is_bot === true &&
      message.reply_to_message?.text === OFFICE_SITE_SEARCH_PROMPT;
    const officeAction = action.startsWith("rpvo:") || text === CUSTOMER_ADMIN_MENU || officeSearchReply;
    const newMenuAction = [CABINET,OBJECTS,ACTS,COUNTER,FILL_PASSPORT,CANCEL_PASSPORT].includes(text);
    if (!verified) return office || officeAction || cabinetAction || newMenuAction;
    if (officeAction) {
      await o.refreshAdmins();
      if (!o.isAdmin(id)) return true;
      if (officeSearchReply) {
        const value = text.replace(/^(?:АЗК|АЗС|мережа)\s*[№#:]?\s*/iu,"").toUpperCase();
        await officeSiteList(id,"find",value,0);
        return true;
      }
      if (callback) await o.telegram("answerCallbackQuery",{callback_query_id:callback.id});
      else await o.clearSession(id);
      await officeMenu(id,callback ? action.slice("rpvo:".length) : "home");
      return true;
    }
    if (callback && !cabinetAction) return false;
    if (office) { await admin(id,command,args); return true; }
    if (text === "/start" || text === "Кабінет підрядника" || (!callback && !text && !message.contact)) return false;
    const state = (await o.getSession(id))?.state;
    const draft: PassportDraft | null = typeof state === "string" && state.startsWith(PASSPORT_PREFIX)
      ? JSON.parse(state.slice(PASSPORT_PREFIX.length)) : null;
    const legacyDraft = typeof state === "string" && state.startsWith(LEGACY_PASSPORT_PREFIX);
    if (!draft && !legacyDraft && !cabinetAction && !newMenuAction && !message.contact) return false;
    const continuing = action === "rpvc:continue";
    if (state !== STATE && !draft && !legacyDraft && !continuing && !(text === CABINET && state === "choosing_cabinet")) return false;
    if (!(await o.rateLimit(id))) return true;
    if (cabinetAction) await o.telegram("answerCallbackQuery",{callback_query_id:callback.id});
    if (continuing) {
      const user = await profile(id);
      if (user?.status === "active" && user.phone) {
        if (draft) await showPassportStep(id,draft);
        else if (await hasAccess(id)) {
          if (await o.setSession(id,STATE)) await openCabinet(id);
          else await send(id,"Не вдалося відкрити кабінет. Спробуйте ще раз.");
        } else await startPassport(id);
      }
      return true;
    }
    if (text === CABINET || ((draft || legacyDraft) && text === CANCEL_PASSPORT)) {
      if (await o.setSession(id,STATE)) await openCabinet(id);
      else await send(id,"Не вдалося відкрити кабінет. Спробуйте ще раз.");
      return true;
    }
    if (text === FILL_PASSPORT || action === "rpvc:new" || legacyDraft) {
      if (draft) await showPassportStep(id,draft);
      else await startPassport(id);
      return true;
    }
    if (draft) {
      await handlePassport(id,state,draft,text,action);
      return true;
    }
    if (message.contact && !callback) { await register(id,user,message.contact); return true; }
    if (!(await hasAccess(id))) { await openCabinet(id); return true; }
    if (text === OBJECTS) await listSites(id);
    if (text === ACTS) await listActs(id);
    if (text === COUNTER) await showCounter(id);
    if (cabinetAction) {
      const [,kind,value,end] = action.split(":");
      const number = (s: string) => /^\d{1,4}$/.test(s ?? "") ? Number(s) : null;
      const page = number(end ?? value);
      if (kind==="s" && UUID.test(value)) await showSite(id,value);
      if (kind==="a" && UUID.test(value)) await showAct(id,value);
      if (kind==="sp" && page!==null) await listSites(id,page);
      if (kind==="archive" && page!==null) await showArchive(id,page);
      if (kind==="ap" && page!==null && (!end || MONTH.test(value))) await listActs(id,page,end ? value : undefined);
      if (kind==="month" && MONTH.test(value) && Number(value.slice(5))>=1 && Number(value.slice(5))<=12) await showCounter(id,value);
    }
    return true;
  }

  return {handle};
}

