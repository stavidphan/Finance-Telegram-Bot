// Biến toàn cục
var TELEGRAM_BOT_TOKEN = "xxxxxx";
var TELEGRAM_CHAT_ID = "xx";
var SHEET_ID = "xxxx";

// Cache toàn cục
var keywordCache = null;
var categoryCache = null; // Cache danh mục và icon

function webhook() {
  deleteWebhook();
  setupWebhook();
}

// ✅ Xóa Webhook
function deleteWebhook() {
  var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/deleteWebhook";
  var response = UrlFetchApp.fetch(url);
  Logger.log("*Delete Webhook response:* " + response.getContentText());
}

// ✅ Thiết lập Webhook
function setupWebhook() {
  var scriptUrl = "https://script.google.com/macros/s/AKfycbyjnBkYoebjkoGFPHj921eV_qpVpvvyB19YmeYcGXoQ6KHkiID-ZtvX0UYLcHIrH3E/exec";
  var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/setWebhook?url=" + encodeURIComponent(scriptUrl);
  var response = UrlFetchApp.fetch(url);
  Logger.log("*Webhook response:* " + response.getContentText());
}

// ✅ Lấy CHAT_ID
function getChatID() {
  var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/getUpdates";
  var response = UrlFetchApp.fetch(url);
  var data = JSON.parse(response.getContentText());
  if (data.result.length > 0) {
    var chatID = data.result[data.result.length - 1].message.chat.id;
    Logger.log("*CHAT_ID:* " + chatID);
    return chatID;
  } else {
    Logger.log("*Không tìm thấy tin nhắn nào.*");
    return null;
  }
}

// ✅ Lưu update_id
function saveUpdateID(update_id) {
  try {
    Logger.log("*Đang lưu update_id:* " + update_id);
    var sheetName = "Update Log";
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      Logger.log("*⚠️ Sheet 'Update Log' không tồn tại! Đang tạo mới...*");
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(["Update_ID"]);
    }

    var lastUpdateID = sheet.getRange("A2").getValue();
    if (String(lastUpdateID) === String(update_id)) {
      Logger.log("*🔁 Tin nhắn trùng, bỏ qua update_id:* " + update_id);
      return false;
    }

    sheet.getRange("A2").setValue(update_id);
    Logger.log("*✅ Update ID mới nhất đã lưu:* " + update_id);
    return true;
  } catch (e) {
    Logger.log("*❌ Lỗi saveUpdateID:* " + e.message);
    sendMessage("*❌ Lỗi hệ thống khi lưu update_id:* " + e.message, { parse_mode: "Markdown" });
    return false;
  }
}

// ✅ Gửi "typing..."
function sendTypingAction() {
  var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendChatAction";
  var payload = { "chat_id": TELEGRAM_CHAT_ID, "action": "typing" };
  var options = { "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload) };
  UrlFetchApp.fetch(url, options);
}

// ✅ Load danh mục và icon từ PropertiesService hoặc sheet "Từ khóa"
function loadCategoryCache() {
  var properties = PropertiesService.getScriptProperties();
  var cachedData = properties.getProperty("categoryCache");

  if (cachedData) {
    categoryCache = new Map(JSON.parse(cachedData));
    Logger.log("*✅ Đã load categoryCache từ PropertiesService*");
    return categoryCache;
  }

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Từ khóa");
  if (!sheet) {
    Logger.log("*❌ Sheet 'Từ khóa' không tồn tại!*");
    categoryCache = new Map([["Khác", "❗"]]);
  } else {
    var data = sheet.getDataRange().getValues();
    categoryCache = new Map();
    for (var i = 1; i < data.length; i++) {
      var category = data[i][1].trim();
      var icon = data[i][2] || "❗";
      categoryCache.set(category, icon);
    }
    if (categoryCache.size === 0) categoryCache.set("Khác", "❗");
  }

  properties.setProperty("categoryCache", JSON.stringify([...categoryCache]));
  Logger.log("*✅ Đã load và lưu categoryCache từ sheet:* " + categoryCache.size + " danh mục");
  return categoryCache;
}

// ✅ Load từ khóa từ PropertiesService hoặc sheet "Từ khóa"
function loadKeywordCache() {
  var properties = PropertiesService.getScriptProperties();
  var cachedData = properties.getProperty("keywordCache");

  if (cachedData) {
    keywordCache = new Map(JSON.parse(cachedData));
    Logger.log("*✅ Đã load keywordCache từ PropertiesService*");
    return keywordCache;
  }

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Từ khóa");
  if (!sheet) {
    Logger.log("*❌ Sheet 'Từ khóa' không tồn tại!*");
    keywordCache = new Map([["", "Khác"]]);
  } else {
    var data = sheet.getDataRange().getValues();
    keywordCache = new Map();
    for (var i = 1; i < data.length; i++) {
      var category = data[i][1].trim();
      var keywords = data[i][3] ? data[i][3].split(",").map(k => k.trim().toLowerCase()) : [];
      keywords.forEach(keyword => {
        if (keyword) keywordCache.set(keyword, category);
      });
    }
    if (keywordCache.size === 0) keywordCache.set("", "Khác");
  }

  properties.setProperty("keywordCache", JSON.stringify([...keywordCache]));
  Logger.log("*✅ Đã load và lưu keywordCache từ sheet:* " + keywordCache.size + " từ khóa");
  return keywordCache;
}

// ✅ Trigger khi sheet "Từ khóa" được chỉnh sửa
function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() === "Từ khóa") {
    var properties = PropertiesService.getScriptProperties();
    properties.deleteProperty("keywordCache");
    properties.deleteProperty("categoryCache");
    loadKeywordCache();  // Tải lại cache mới từ sheet "Từ khóa"
    loadCategoryCache(); // Tải lại cache mới từ sheet "Từ khóa"
    Logger.log("*✅ Cache đã được cập nhật do chỉnh sửa sheet 'Từ khóa'*");
  }
}

// ✅ Hiển thị danh sách danh mục
function sendCategoryList() {
  var categories = loadCategoryCache();
  let message = "*📋 Danh sách danh mục:*\n";
  let index = 1;
  categories.forEach((icon, category) => {
    message += `${index}. ${icon} *${category}*\n`;
    index++;
  });
  sendMessage(message, { parse_mode: "Markdown" });
}

// ✅ Thêm từ khóa
function addKeyword(keyword, categoryIndex) {
  try {
    var categories = Array.from(loadCategoryCache().keys());
    if (categoryIndex < 1 || categoryIndex > categories.length) {
      sendMessage("*❌ Số thứ tự danh mục không hợp lệ!*", { parse_mode: "Markdown" });
      return false;
    }

    var category = categories[categoryIndex - 1];
    var categoryIcon = loadCategoryCache().get(category) || "❗";
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Từ khóa");
    if (!sheet) {
      sheet = SpreadsheetApp.openById(SHEET_ID).insertSheet("Từ khóa");
      sheet.appendRow(["Số thứ tự danh mục", "Danh mục", "ICON", "Từ khóa"]);
    }

    var data = sheet.getDataRange().getValues();
    var rowToUpdate = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][1].trim() === category) {
        rowToUpdate = i;
        break;
      }
    }

    if (rowToUpdate !== -1) {
      var existingKeywords = data[rowToUpdate][3] ? data[rowToUpdate][3].split(",").map(k => k.trim().toLowerCase()) : [];
      if (!existingKeywords.includes(keyword.toLowerCase())) {
        existingKeywords.push(keyword.toLowerCase());
        sheet.getRange(rowToUpdate + 1, 4).setValue(existingKeywords.join(", "));
        sendMessage(`*✅ Đã thêm từ khóa '${keyword}' vào danh mục ${categoryIcon} '${category}'*`, { parse_mode: "Markdown" });
      } else {
        sendMessage(`*⚠️ Từ khóa '${keyword}' đã tồn tại trong danh mục ${categoryIcon} '${category}'*`, { parse_mode: "Markdown" });
        return true;
      }
    } else {
      var nextRow = sheet.getLastRow() + 1;
      var newRow = [nextRow - 1, category, loadCategoryCache().get(category) || "❗", keyword.toLowerCase()];
      sheet.getRange(nextRow, 1, 1, 4).setValues([newRow]);
      sendMessage(`*✅ Đã tạo danh mục ${categoryIcon} '${category}' và thêm từ khóa '${keyword}'*`, { parse_mode: "Markdown" });
    }

    // Cập nhật cache sau khi thay đổi sheet
    var properties = PropertiesService.getScriptProperties();
    keywordCache = null;
    categoryCache = null;
    properties.deleteProperty("keywordCache");
    properties.deleteProperty("categoryCache");
    loadKeywordCache(); // Tải lại cache mới
    loadCategoryCache(); // Tải lại cache mới
    return true;
  } catch (e) {
    Logger.log("*❌ Lỗi addKeyword:* " + e.message);
    sendMessage("*❌ Lỗi hệ thống khi thêm từ khóa:* " + e.message, { parse_mode: "Markdown" });
    return false;
  }
}

// ✅ Xử lý tin nhắn từ Telegram
function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      Logger.log("*❌ Dữ liệu POST không hợp lệ!*");
      return;
    }

    var data = JSON.parse(e.postData.contents);
    // Ghi log dữ liệu gốc từ Telegram
    Logger.log("*📩 Dữ liệu gốc từ Telegram:* " + JSON.stringify(data));
    Logger.log("*📩 Nội dung tin nhắn gốc:* " + data.message.text);

    if (!data.message || !data.message.text) {
      Logger.log("*❌ Tin nhắn không có nội dung!*");
      return;
    }

    var text = data.message.text.trim().replace(/\s+/g, " "); // Giữ nguyên định dạng sau khi xử lý
    var update_id = data.update_id || null;
    Logger.log("*📩 Tin nhắn sau xử lý:* " + text + " *| update_id:* " + update_id);

    if (text.startsWith("/")) {
      if (!processCommand(text, update_id)) {
        sendErrorMessage("command");
      }
    } else {
      // Ưu tiên kiểm tra pending email transactions trước
      var pending = getPendingTransactions();
      if (pending && pending.length > 0) {
        if (!saveUpdateID(update_id)) return;
        sendTypingAction();
        // Dùng nguyên văn data gốc (giữ lại khoảng trắng/xuống dòng) cho tính năng bulk note
        confirmAndSaveEmailTransactions(data.message.text.trim());
      } else {
        if (!processTransaction(text, update_id)) {
          sendErrorMessage("transaction");
        }
      }
    }
  } catch (e) {
    Logger.log("*❌ Lỗi doPost:* " + e.message);
    sendMessage("*❌ Lỗi hệ thống:* " + e.message, { parse_mode: "Markdown" });
  }
}

// ✅ Xử lý lệnh
function processCommand(text, update_id) {
  if (!saveUpdateID(update_id)) return false;

  sendTypingAction();
  var parts = text.split(" ");
  var command = parts[0].toLowerCase();
  var subCommand = parts.slice(1).join(" ");

  Logger.log("*📩 Lệnh gốc:* " + text);
  Logger.log("*📩 Command:* " + command + " | *SubCommand:* " + subCommand);

  switch (command) {
    case "/miniapp":
      Logger.log("*📌 Nhận lệnh /stats*");
      sendMiniAppButton();
      return true;

    case "/danhmuc":
      Logger.log("*📌 Nhận lệnh /danhmuc*");
      sendCategoryList();
      return true;

    case "/themtukhoa":
      if (parts.length < 3 || isNaN(parts[parts.length - 1])) {
        sendMessage("*❌ Sai cú pháp!*", { parse_mode: "Markdown" });
        return false;
      }
      var categoryIndex = parseInt(parts.pop());
      var keyword = parts.slice(1).join(" ").trim();
      addKeyword(keyword, categoryIndex);
      return true;

    case "/suaphanloai":
      if (parts.length < 2 || isNaN(parts[1])) {
        sendMessage("*❌ Sai cú pháp!*", { parse_mode: "Markdown" });
        return false;
      }
      var categoryIndex = parseInt(parts[1]);
      correctCategory(categoryIndex);
      return true;

    case "/suadinhdang":
      if (subCommand !== "thu nhập" && subCommand !== "chi tiêu") {
        sendMessage("*❌ Sai cú pháp!*", { parse_mode: "Markdown" });
        return false;
      }
      var newType = subCommand === "thu nhập" ? "Thu nhập" : "Chi tiêu";
      correctType(newType);
      return true;

    case "/baocaongay":
      var [day, month] = parseDate(text, "/baocaongay");
      if (day && month) sendDailyReport(day, month);
      return true;

    case "/baocaothang":
      var month = parseMonth(text, "/baocaothang");
      if (month) sendMonthlyReport(month);
      return true;

    case "/phantichthang":
      var month = parseMonth(text, "/phantichthang");
      if (month) sendTextChart(month, null);
      return true;

    case "/phantichngay":
      var [day, month] = parseDate(text, "/phantichngay");
      if (day && month) sendTextChart(month, day);
      return true;

    case "/chitietthang":
      var month = parseMonth(text, "/chitietthang");
      if (month) sendDetailedMonthlyReport(month);
      return true;

    case "/chitietngay":
      var [day, month] = parseDate(text, "/chitietngay");
      if (day && month) sendDetailedDailyReport(day, month);
      return true;

    case "/suanoidung":
      if (subCommand.trim() === "") {
        sendMessage("*❌ Vui lòng nhập nội dung cần sửa!*", { parse_mode: "Markdown" });
        return false;
      }
      correctContent(subCommand);
      return true;

    case "/huongdan":
      Logger.log("*📌 Nhận lệnh /huongdan*");
      sendHelpMessage();
      return true;

    case "/scanmail":
      Logger.log("*📌 Nhận lệnh /scanmail*");
      triggerEmailScan();
      return true;

    default:
      return false;
  }
}

// ✅ Xử lý giao dịch (không ghi đè G2, H2)
function processTransaction(text, update_id) {
  var regexWithNote = /^(\d{1,2}\/\d{1,2})\s+([+-]?(?:\d+(?:\.\d+)?[kKmM]?|\d+m\d+))\s+(.+?)\s*\((.+?)\)$/;
  var regexNoNote = /^(\d{1,2}\/\d{1,2})\s+([+-]?(?:\d+(?:\.\d+)?[kKmM]?|\d+m\d+))\s+(.+)$/;
  var oldRegexWithNote = /^([+-]?(?:\d+(?:\.\d+)?[kKmM]?|\d+m\d+))\s+(.+?)\s*\((.+?)\)$/;
  var oldRegexNoNote = /^([+-]?(?:\d+(?:\.\d+)?[kKmM]?|\d+m\d+))\s+(.+)$/;

  var now = new Date();
  var inputDate = Utilities.formatDate(now, "GMT+7", "dd/MM");
  var amountText, category, note;

  var match = text.match(regexWithNote);
  if (match) {
    inputDate = normalizeDate(match[1]);
    amountText = match[2];
    category = match[3].trim();
    note = capitalizeNote(match[4].trim());
  } else {
    match = text.match(regexNoNote);
    if (match) {
      inputDate = normalizeDate(match[1]);
      amountText = match[2];
      category = match[3].trim();
      note = "";
    } else {
      match = text.match(oldRegexWithNote);
      if (match) {
        amountText = match[1];
        category = match[2].trim();
        note = capitalizeNote(match[3].trim());
      } else {
        match = text.match(oldRegexNoNote);
        if (!match) return false;
        amountText = match[1];
        category = match[2].trim();
        note = "";
      }
    }
  }

  category = capitalizeFirstLetter(category);
  var amount = parseMoney(amountText);
  if (!amount || isNaN(amount) || amount <= 0) {
    sendMessage("*❌ Số tiền không hợp lệ! Vui lòng nhập số tiền đúng format (ví dụ: 500k, 1.5m, 1m5, hoặc số nguyên).*", { parse_mode: "Markdown" });
    return false;
  }

  if (!saveUpdateID(update_id)) return false;

  var normalizedDate = normalizeDate(inputDate);
  if (!isValidDate(normalizedDate)) {
    sendMessage("*❌ Ngày không hợp lệ! Vui lòng nhập ngày từ 01/01 đến 31/12 (ví dụ: 05/03).*", { parse_mode: "Markdown" });
    return false;
  }

  var type = amountText.startsWith("+") ? "Thu nhập" : "Chi tiêu";
  var categoryDetail = getCategoryDetail(category);

  Logger.log(`*🔄 Xử lý giao dịch:* ${normalizedDate} *|* ${type} *|* ${category} *|* ${amount} *|* ${categoryDetail} *|* Ghi chú: ${note}`);

  sendTypingAction();

  var month = parseInt(normalizedDate.split("/")[1], 10);
  var year = new Date().getFullYear();

  // Tự động tạo sheet nếu chưa có
  var sheet = getSheetByMonth(month, year);
  if (!sheet) {
    sendMessage(`*❌ Không thể tạo sheet cho tháng ${month}/${year}.*`, { parse_mode: "Markdown" });
    return false;
  }

  saveToSheet(sheet, normalizedDate, type, category, amount, categoryDetail, note);

  // Lấy tổng tháng từ G2, H2
  var totalIncome = sheet.getRange("G2").getValue() || 0;
  var totalExpense = sheet.getRange("H2").getValue() || 0;
  var typeIcon = type === "Thu nhập" ? "💰" : "💸";

  var categoryIcon = loadCategoryCache().get(categoryDetail) || "❗";
  var formattedAmount = amount.toLocaleString('vi-VN') + " ₫";

  var message = `*✅ Đã ghi nhận giao dịch*\n\n` +
    `*${typeIcon} ${type}*\n` +
    `*💰 Số tiền:* ${formattedAmount}\n` +
    `*📝 Mô tả:* ${category}\n` +
    `*${categoryIcon} Danh mục:* ${categoryDetail}\n` +
    `*📅 Ngày:* ${normalizedDate}\n`;
  if (note) message += `*📌 Ghi chú:* ${note}\n`;
  message += `\n*📊 Tổng kết tháng ${month}:*\n` +
    `💰 Thu nhập: ${totalIncome.toLocaleString('vi-VN')} ₫\n` +
    `💸 Chi tiêu: ${totalExpense.toLocaleString('vi-VN')} ₫\n`;

  sendMessage(message, { parse_mode: "Markdown" });
  return true;
}

// ✅ Kiểm tra ngày hợp lệ
function isValidDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  var [day, month] = normalizeDate(dateStr).split("/").map(Number);
  if (isNaN(day) || isNaN(month)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  var daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var now = new Date();
  var year = now.getFullYear();
  if (month === 2 && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) {
    daysInMonth[1] = 29;
  }

  if (day > daysInMonth[month - 1]) return false;
  return true;
}

// ✅ Chuẩn hóa ngày
function normalizeDate(dateStr) {
  var now = new Date();
  var defaultDay = String(now.getDate()).padStart(2, '0');
  var defaultMonth = String(now.getMonth() + 1).padStart(2, '0');

  if (typeof dateStr !== 'string' || !dateStr.trim()) {
    return `${defaultDay}/${defaultMonth}`;
  }

  var parts = dateStr.split("/").map(d => parseInt(d, 10));
  var day = parts[0] || parseInt(defaultDay, 10);
  var month = parts[1] || parseInt(defaultMonth, 10);

  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

// ✅ Ghi dữ liệu vào Sheet (không ghi đè G2, H2)
function saveToSheet(sheet, inputDate, type, description, amount, categoryDetail, note) {
  try {
    // Đọc dữ liệu bảng chính (chỉ cột A-F, không bao gồm khu vực sao kê/chart)
    var lastMainRow = getLastMainTableRow(sheet);
    var data = [];
    if (lastMainRow >= 1) {
      data = sheet.getRange(1, 1, lastMainRow, 6).getValues();
    }

    if (data.length === 0 || !data[0] || data[0].length === 0) {
      var headers = ["Ngày", "Loại giao dịch", "Danh mục", "Số tiền", "Mô tả", "Ghi chú"];
      sheet.getRange(1, 1, 1, 6).setValues([headers]);
      data = [headers];
    }

    // Cấu trúc: [Ngày, Loại giao dịch, Danh mục, Số tiền, Mô tả, Ghi chú]
    // categoryDetail = Danh mục từ sheet "Từ khóa" (ví dụ: "Đi lại") - ở cột C
    // description = Mô tả từ tin nhắn người dùng (ví dụ: "Đồ xăng") - ở cột E
    var newData = [inputDate, type, categoryDetail, amount, description, note];

    if (data.length <= 1) {
      sheet.getRange(2, 1, 1, 6).setValues([newData]);
    } else {
      var bodyData = data.slice(1).map(row => row.slice(0, 6));
      bodyData.push(newData);
      bodyData.sort((a, b) => compareDates(a[0], b[0]));
      sheet.getRange(2, 1, bodyData.length, 6).setValues(bodyData);
    }

    Logger.log("*✅ Đã ghi dữ liệu vào Sheet:* " + inputDate);

    // Định dạng cột D (Số tiền) với dấu phân cách hàng nghìn
    var lastRow = getLastMainTableRow(sheet);
    if (lastRow > 1) {
      sheet.getRange(2, 4, lastRow - 1, 1).setNumberFormat("#,##0");
    }

    // Áp dụng màu xanh cho số tiền thu nhập
    applyAmountColorFormatting(sheet);

    // Cập nhật biểu đồ sau khi thêm dữ liệu mới
    createOrUpdateChart(sheet);

    return true;
  } catch (e) {
    Logger.log("*❌ Lỗi saveToSheet:* " + e.message);
    sendMessage("*❌ Lỗi ghi dữ liệu vào Sheet:* " + e.message, { parse_mode: "Markdown" });
    return false;
  }
}

// ✅ Xác định danh mục chi tiết (Cache)
function getCategoryDetail(description) {
  try {
    var keywordsMap = loadKeywordCache();
    description = description.toLowerCase().trim();

    var bestMatch = "Khác";
    var bestMatchScore = 0;

    keywordsMap.forEach((category, keyword) => {
      if (description.includes(keyword)) {
        var score = keyword.split(/\s+/).length;
        if (score > bestMatchScore) {
          bestMatch = category;
          bestMatchScore = score;
        }
      }
    });

    Logger.log(`*Đã chọn danh mục:* ${bestMatch} *cho mô tả:* ${description}`);
    return bestMatch;
  } catch (e) {
    Logger.log("*❌ Lỗi getCategoryDetail:* " + e.message);
    sendMessage("*❌ Lỗi phân loại danh mục:* " + e.message, { parse_mode: "Markdown" });
    return "Khác";
  }
}

// ✅ Chuyển đổi số tiền
function parseMoney(input) {
  if (!input) return 0;
  var cleanInput = input.replace(/^\+/, "").trim().toLowerCase();
  if (!cleanInput) return 0;

  var customMatch = cleanInput.match(/^(\d+)m(\d+)$/);
  if (customMatch) {
    var whole = customMatch[1];
    var decimal = customMatch[2];
    var numberPart = parseFloat(whole + "." + decimal);
    var amount = numberPart * 1000000;
    return amount > 0 ? Math.round(amount) : 0;
  }

  var match = cleanInput.match(/^(\d+(?:\.\d+)?)([km]?)$/);
  if (!match) return 0;

  var numberPart = match[1];
  var suffix = match[2];

  var amount = parseFloat(numberPart) || 0;
  if (suffix === "k") amount *= 1000;
  else if (suffix === "m") amount *= 1000000;

  return amount > 0 ? Math.round(amount) : 0;
}

// ✅ So sánh ngày
function compareDates(date1, date2) {
  var normalizeDateLocal = function (dateStr) {
    if (typeof dateStr !== 'string') return "01/01";
    var parts = dateStr.split("/").map(d => parseInt(d, 10));
    var day = parts[0] || 1;
    var month = parts[1] || 1;
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
  };
  var normalizedDate1 = normalizeDateLocal(date1);
  var normalizedDate2 = normalizeDateLocal(date2);
  var [day1, month1] = normalizedDate1.split("/").map(Number);
  var [day2, month2] = normalizedDate2.split("/").map(Number);
  if (month1 !== month2) return month1 - month2;
  return day1 - day2;
}

// ✅ Helper: Tạo tên sheet theo định dạng MM-YYYY
function getSheetNameByMonth(month, year) {
  if (!year) {
    year = new Date().getFullYear();
  }
  return String(month).padStart(2, '0') + "-" + year;
}

// ✅ Helper: Lấy hoặc tạo Sheet theo tháng (tự động tạo nếu chưa có)
// lightMode = true: bỏ qua setup nặng (chart, format, ledger headers) — dùng cho bulk email save
function getSheetByMonth(month, year, lightMode) {
  if (!year) {
    year = new Date().getFullYear();
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheetName = getSheetNameByMonth(month, year);

  // Thử tìm sheet với format mới (MM-YYYY)
  var sheet = ss.getSheetByName(sheetName);

  // Nếu không tìm thấy, thử format cũ (Tháng 01, Tháng 02, ...) để backward compatible
  if (!sheet) {
    var oldSheetName = "Tháng " + String(month).padStart(2, '0');
    sheet = ss.getSheetByName(oldSheetName);

    // Nếu tìm thấy sheet cũ, đổi tên sang format mới
    if (sheet) {
      sheet.setName(sheetName);
      Logger.log("✅ Đã đổi tên sheet từ '" + oldSheetName + "' sang '" + sheetName + "'");
    }
  }

  // Nếu vẫn không có, tạo sheet mới
  if (!sheet) {
    var tuKhoaSheet = ss.getSheetByName("Từ khóa");
    var insertIndex = tuKhoaSheet ? tuKhoaSheet.getIndex() : 1;
    sheet = ss.insertSheet(sheetName, insertIndex);

    // Tạo header row
    var headers = ["Ngày", "Loại giao dịch", "Danh mục", "Số tiền", "Mô tả", "Ghi chú"];
    sheet.getRange(1, 1, 1, 6).setValues([headers]);

    // Định dạng header row (in đậm, màu nền)
    var headerRange = sheet.getRange(1, 1, 1, 6);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4285f4");
    headerRange.setFontColor("#ffffff");
    headerRange.setHorizontalAlignment("center");

    // Cố định hàng tiêu đề & thêm bộ lọc cho bảng chính (A-F)
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 6).createFilter();

    // Đặt độ rộng cột
    sheet.setColumnWidth(1, 80);  // Ngày
    sheet.setColumnWidth(2, 120); // Loại giao dịch
    sheet.setColumnWidth(3, 120); // Danh mục
    sheet.setColumnWidth(4, 100); // Số tiền
    sheet.setColumnWidth(5, 200); // Mô tả
    sheet.setColumnWidth(6, 150); // Ghi chú

    // Tạo các cell G1-H2 với công thức SUMIF
    sheet.getRange("G1").setValue("Tổng thu nhập");
    sheet.getRange("H1").setValue("Tổng chi tiêu");

    // Công thức SUMIF động (sử dụng toàn bộ cột để tự động cập nhật)
    sheet.getRange("G2").setFormula('=SUMIF(B:B;"Thu nhập";D:D)');
    sheet.getRange("H2").setFormula('=SUMIF(B:B;"Chi tiêu";D:D)');

    // Định dạng header G1, H1 (in đậm, màu nền)
    var summaryHeaderRange = sheet.getRange("G1:H1");
    summaryHeaderRange.setFontWeight("bold");
    summaryHeaderRange.setBackground("#f0f0f0");

    // Định dạng G2, H2 (số, format tiền)
    var summaryValueRange = sheet.getRange("G2:H2");
    summaryValueRange.setNumberFormat("#,##0");

    // Định dạng cột D (Số tiền) với dấu phân cách hàng nghìn
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 4, lastRow - 1, 1).setNumberFormat("#,##0");
    }

    // Áp dụng màu xanh cho số tiền thu nhập
    applyAmountColorFormatting(sheet);

    // Đặt độ rộng cột G, H
    sheet.setColumnWidth(7, 120); // Tổng thu nhập
    sheet.setColumnWidth(8, 120); // Tổng chi tiêu

    // Di chuyển sheet đến vị trí thứ 3 (index 2)
    // Mã cũ force sheet về vị trí thứ 3 đã bị xóa
    // vì lúc tạo sheet (insertSheet) đã chèn đúng vào sau sheet Từ khóa


    // Tạo biểu đồ phân tích chi tiêu theo danh mục
    createOrUpdateChart(sheet);

    // Tạo header cho bảng giao dịch riêng từng thẻ tín dụng (cột Q+)
    ensureCreditCardLedgerHeaders(sheet);

    Logger.log("✅ Đã tạo sheet mới: " + sheetName);
  } else {
    // Đảm bảo sheet đã tồn tại có các cell G1-H2 (tạo nếu chưa có)
    var g1Value = sheet.getRange("G1").getValue();
    var h1Value = sheet.getRange("H1").getValue();

    // Nếu chưa có, tạo mới
    if (!g1Value && !h1Value) {
      sheet.getRange("G1").setValue("Tổng thu nhập");
      sheet.getRange("H1").setValue("Tổng chi tiêu");

      // Công thức SUMIF động
      sheet.getRange("G2").setFormula('=SUMIF(B:B;"Thu nhập";D:D)');
      sheet.getRange("H2").setFormula('=SUMIF(B:B;"Chi tiêu";D:D)');

      // Định dạng
      var summaryHeaderRange = sheet.getRange("G1:H1");
      summaryHeaderRange.setFontWeight("bold");
      summaryHeaderRange.setBackground("#f0f0f0");

      var summaryValueRange = sheet.getRange("G2:H2");
      summaryValueRange.setNumberFormat("#,##0");

      // Định dạng cột D (Số tiền) với dấu phân cách hàng nghìn
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.getRange(2, 4, lastRow - 1, 1).setNumberFormat("#,##0");
      }

      // Áp dụng màu xanh cho số tiền thu nhập
      applyAmountColorFormatting(sheet);

      sheet.setColumnWidth(7, 120);
      sheet.setColumnWidth(8, 120);

      Logger.log("✅ Đã thêm các cell G1-H2 vào sheet: " + sheetName);
    }

    if (!lightMode) {
      // Đảm bảo biểu đồ tồn tại
      createOrUpdateChart(sheet);

      // Đảm bảo cột D (Số tiền) có định dạng số với dấu phân cách hàng nghìn
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.getRange(2, 4, lastRow - 1, 1).setNumberFormat("#,##0");
      }

      // Áp dụng màu xanh cho số tiền thu nhập
      applyAmountColorFormatting(sheet);

      // Đảm bảo header bảng riêng thẻ tín dụng tồn tại (cột Q+)
      ensureCreditCardLedgerHeaders(sheet);

      // Đảm bảo cố định hàng tiêu đề & bộ lọc bảng chính
      ensureMainTableFilter(sheet);
    }
  }

  return sheet;
}

// ✅ Đảm bảo hàng header bảng chính được cố định và có bộ lọc (idempotent)
function ensureMainTableFilter(sheet) {
  try {
    // Cố định hàng 1 nếu chưa
    if (sheet.getFrozenRows() < 1) {
      sheet.setFrozenRows(1);
    }
    // Highlight header nếu chưa có màu
    var headerRange = sheet.getRange(1, 1, 1, 6);
    if (!headerRange.getBackground() || headerRange.getBackground() === "#ffffff") {
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#4285f4");
      headerRange.setFontColor("#ffffff");
      headerRange.setHorizontalAlignment("center");
    }
    // Tạo filter nếu chưa có
    var existingFilter = sheet.getFilter();
    if (!existingFilter) {
      headerRange.createFilter();
    }
  } catch (e) {
    Logger.log("⚠️ [ensureMainTableFilter] " + e.message);
  }
}

// ✅ Tạo hoặc cập nhật biểu đồ phân tích chi tiêu theo danh mục trong sheet
function createOrUpdateChart(sheet) {
  try {
    var chartId = "expense_chart_" + sheet.getSheetId();
    var existingCharts = sheet.getCharts();
    var chart = null;

    // Tìm biểu đồ đã tồn tại (tìm theo vị trí hoặc title)
    for (var i = 0; i < existingCharts.length; i++) {
      try {
        var chartOptions = existingCharts[i].getOptions();
        if (chartOptions && chartOptions.get('title') === 'Phân tích chi tiêu theo danh mục') {
          chart = existingCharts[i];
          break;
        }
      } catch (e) {
        // Bỏ qua nếu không đọc được options
      }
    }

    // Nếu không tìm thấy theo title, tìm biểu đồ đầu tiên ở vị trí J4 (cột 9, hàng 4)
    if (!chart && existingCharts.length > 0) {
      // Giả định biểu đồ đầu tiên là biểu đồ chi tiêu (có thể cải thiện sau)
      chart = existingCharts[0];
    }

    // Tạo dữ liệu cho biểu đồ từ dữ liệu trong sheet
    var data = sheet.getDataRange().getValues();
    var expenseByCategory = {}; // Chi tiêu theo danh mục
    var incomeByCategory = {}; // Thu nhập theo danh mục

    // Tính riêng chi tiêu và thu nhập theo danh mục
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row || row.length < 5) continue;

      var type = String(row[1] || "").trim();
      var category = String(row[2] || "").trim(); // Danh mục ở cột C
      var amountValue = row[3];

      if (category) {
        var amount = 0;
        if (typeof amountValue === 'number') {
          amount = amountValue;
        } else if (typeof amountValue === 'string') {
          var cleanAmount = amountValue.replace(/[^\d.,]/g, '').replace(/,/g, '');
          amount = parseFloat(cleanAmount) || 0;
        } else {
          amount = parseFloat(amountValue) || 0;
        }

        if (!isNaN(amount) && amount > 0) {
          if (type === "Chi tiêu") {
            expenseByCategory[category] = (expenseByCategory[category] || 0) + amount;
          } else if (type === "Thu nhập") {
            incomeByCategory[category] = (incomeByCategory[category] || 0) + amount;
          }
        }
      }
    }

    // Tính chi tiêu trừ đi thu nhập (nếu cùng danh mục) - coi như hoàn tiền
    var netAmountByCategory = {};
    var allCategories = new Set();

    // Thêm tất cả danh mục có chi tiêu
    Object.keys(expenseByCategory).forEach(function (cat) {
      allCategories.add(cat);
    });

    // Thêm tất cả danh mục có thu nhập
    Object.keys(incomeByCategory).forEach(function (cat) {
      allCategories.add(cat);
    });

    // Tính số tiền ròng (chi tiêu - thu nhập) cho mỗi danh mục
    allCategories.forEach(function (cat) {
      var expense = expenseByCategory[cat] || 0;
      var income = incomeByCategory[cat] || 0;
      var netAmount = expense - income; // Chi tiêu trừ đi thu nhập

      // Chỉ thêm vào biểu đồ nếu số tiền ròng > 0
      if (netAmount > 0) {
        netAmountByCategory[cat] = netAmount;
      }
    });

    // Nếu không có dữ liệu, không tạo biểu đồ
    if (Object.keys(netAmountByCategory).length === 0) {
      if (chart) {
        sheet.removeChart(chart);
        Logger.log("✅ Đã xóa biểu đồ vì không có dữ liệu");
      }
      return;
    }

    // Tạo dữ liệu cho biểu đồ (tối đa 10 danh mục lớn nhất)
    var categories = Object.keys(netAmountByCategory);
    categories.sort(function (a, b) {
      return netAmountByCategory[b] - netAmountByCategory[a];
    });
    categories = categories.slice(0, 10); // Lấy 10 danh mục lớn nhất

    // Tính tổng số tiền ròng để tính phần trăm
    var totalNetAmount = 0;
    categories.forEach(function (cat) {
      totalNetAmount += netAmountByCategory[cat];
    });

    // Tạo range dữ liệu cho biểu đồ (J1:L11) với label kết hợp phần trăm và số tiền
    var chartDataRange = sheet.getRange("J1:L" + (categories.length + 1));
    var chartData = [["Danh mục", "Số tiền", "Label"]];
    categories.forEach(function (cat) {
      var amount = netAmountByCategory[cat];
      var percentage = ((amount / totalNetAmount) * 100).toFixed(1);
      var formattedAmount = amount.toLocaleString('vi-VN') + " ₫";
      var label = cat + " (" + percentage + "% - " + formattedAmount + ")";
      chartData.push([cat, amount, label]);
    });
    chartDataRange.setValues(chartData);

    // Highlight header dòng 1 của vùng chart data (J1:L1)
    var chartHeaderRange = sheet.getRange("J1:L1");
    chartHeaderRange.setFontWeight("bold");
    chartHeaderRange.setBackground("#e8eaf6");
    chartHeaderRange.setFontColor("#1a237e");
    chartHeaderRange.setHorizontalAlignment("center");

    // Định dạng cột số tiền
    if (categories.length > 0) {
      var amountRange = sheet.getRange("K2:K" + (categories.length + 1));
      amountRange.setNumberFormat("#,##0");
    }

    // Tạo hoặc cập nhật biểu đồ
    if (!chart) {
      // Dải dữ liệu cố định cho 10 danh mục (J1:K11)
      var chartRange = sheet.getRange("J1:K100");

      chart = sheet.newChart()
        .setChartType(Charts.ChartType.PIE)
        .addRange(chartRange) // Sử dụng cột Danh mục và Số tiền
        .setPosition(4, 9, 0, 0) // Vị trí: hàng 4, cột 9 (J), offset 0,0
        .setOption('title', 'Phân tích tài chính theo danh mục')
        .setOption('width', 500) // Kích thước vừa phải cho sheet
        .setOption('height', 400)
        .setOption('legend.position', 'right')
        .setOption('pieSliceText', 'value-and-percentage') // Hiển thị cả giá trị và phần trăm
        .setOption('pieSliceTextStyle', { fontSize: 11, bold: true })
        .setOption('tooltip', { trigger: 'selection' })
        .build();

      sheet.insertChart(chart);
      Logger.log("✅ Đã tạo biểu đồ mới trong sheet: " + sheet.getName());
    } else {
      // Chart đã tồn tại thì tự động update khi vùng J1:K11 thay đổi 
      // => Không cần gọi API updateChart để tiết kiệm thời gian
      Logger.log("✅ Đã cập nhật Data Chart trong sheet: " + sheet.getName());
    }
  } catch (e) {
    Logger.log("⚠️ Lỗi tạo biểu đồ: " + e.message);
    // Không throw error để không ảnh hưởng đến các chức năng khác
  }
}

// ✅ Áp dụng màu xanh cho số tiền thu nhập trong cột D (Tối ưu API calls)
function applyAmountColorFormatting(sheet, startRow, numRows) {
  try {
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return; // Không có dữ liệu

    var rStart = startRow || 2;
    var rCount = numRows || (lastRow - rStart + 1);

    if (rStart > lastRow) return;
    if (rStart + rCount - 1 > lastRow) rCount = lastRow - rStart + 1;
    if (rCount <= 0) return;

    // Lấy nguyên cột B (Loại giao dịch) trong 1 lần gọi API
    var typeRange = sheet.getRange(rStart, 2, rCount, 1);
    var types = typeRange.getValues();

    var fontColors = [];
    var fontWeights = [];

    // Xử lý dữ liệu trong RAM thay vì gọi API từng dòng
    for (var i = 0; i < types.length; i++) {
      var type = types[i][0];
      if (type === "Thu nhập") {
        fontColors.push(["#37d462"]); // Xanh lá
        fontWeights.push(["bold"]);
      } else {
        fontColors.push(["#000000"]); // Đen
        fontWeights.push(["normal"]);
      }
    }

    // Set màu và font nguyên mảng trong 1 lần gọi API
    var amountRange = sheet.getRange(rStart, 4, rCount, 1);
    amountRange.setFontColors(fontColors);
    amountRange.setFontWeights(fontWeights);

  } catch (e) {
    Logger.log("⚠️ Lỗi áp dụng màu cho số tiền: " + e.message);
  }
}

// ✅ Export chart từ sheet thành hình ảnh và gửi qua Telegram
function sendChartImage(expenseDetails, expenseTotal, month, day) {
  try {
    Logger.log("🔍 Bắt đầu sendChartImage - month: " + month + ", day: " + day);

    var year = new Date().getFullYear();
    var sheet = getSheetByMonth(month, year);
    if (!sheet) {
      Logger.log("❌ Không tìm thấy sheet để export chart");
      sendMessage("❌ Không tìm thấy sheet tháng " + month, { parse_mode: "Markdown" });
      return false;
    }

    Logger.log("✅ Tìm thấy sheet: " + sheet.getName());

    // Tìm biểu đồ trong sheet
    var charts = sheet.getCharts();
    Logger.log("📊 Số lượng chart trong sheet: " + charts.length);

    var chart = null;

    for (var i = 0; i < charts.length; i++) {
      try {
        var chartOptions = charts[i].getOptions();
        var title = chartOptions ? chartOptions.get('title') : null;
        Logger.log("📊 Chart " + i + " title: " + title);
        if (title === 'Phân tích chi tiêu theo danh mục') {
          chart = charts[i];
          Logger.log("✅ Tìm thấy chart đúng title");
          break;
        }
      } catch (e) {
        Logger.log("⚠️ Lỗi đọc chart " + i + ": " + e.message);
      }
    }

    // Nếu không tìm thấy biểu đồ theo title, lấy biểu đồ đầu tiên
    if (!chart && charts.length > 0) {
      chart = charts[0];
      Logger.log("⚠️ Dùng chart đầu tiên (không tìm thấy đúng title)");
    }

    if (!chart) {
      Logger.log("❌ Không tìm thấy biểu đồ trong sheet để export");
      sendMessage("❌ Không tìm thấy biểu đồ trong sheet tháng " + month, { parse_mode: "Markdown" });
      return false;
    }

    Logger.log("✅ Đã tìm thấy chart để export");

    // Export chart trực tiếp thành image (không modify chart để tránh lỗi)
    var chartTitle = "Chi tiêu tháng " + month;

    Logger.log("📸 Đang export chart thành PNG...");

    // Export trực tiếp mà không modify chart trước
    var imageBlob;
    try {
      imageBlob = chart.getAs('image/png');
      imageBlob.setName("chart_" + month + ".png");
    } catch (e) {
      Logger.log("❌ Lỗi khi export chart: " + e.message);
      sendMessage("❌ Lỗi khi export biểu đồ: " + e.message, { parse_mode: "Markdown" });
      return false;
    }

    var blobSize = imageBlob.getBytes().length;
    Logger.log("📦 Image blob size: " + blobSize + " bytes");

    if (!imageBlob || blobSize === 0) {
      Logger.log("❌ Image blob rỗng hoặc không tồn tại!");
      sendMessage("❌ Không thể export biểu đồ (blob rỗng)", { parse_mode: "Markdown" });
      return false;
    }

    // Gửi hình ảnh qua Telegram
    var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendPhoto";

    Logger.log("📤 Đang gửi ảnh đến Telegram...");
    Logger.log("📤 URL: " + url);
    Logger.log("📤 Chat ID: " + TELEGRAM_CHAT_ID);

    var formData = {
      'chat_id': TELEGRAM_CHAT_ID,
      'caption': chartTitle,
      'photo': imageBlob
    };

    var options = {
      'method': 'post',
      'payload': formData,
      'muteHttpExceptions': true
    };

    var response = UrlFetchApp.fetch(url, options);
    var responseText = response.getContentText();
    var responseCode = response.getResponseCode();

    Logger.log("📤 Response code: " + responseCode);
    Logger.log("📤 Response text: " + responseText);

    // Kiểm tra response
    if (responseCode !== 200) {
      Logger.log("❌ Lỗi gửi biểu đồ. Response code: " + responseCode);
      Logger.log("❌ Full response: " + responseText);
      sendMessage("❌ Lỗi gửi biểu đồ: " + responseText.substring(0, 100), { parse_mode: "Markdown" });
      return false;
    }

    // Parse response để kiểm tra
    try {
      var responseJson = JSON.parse(responseText);
      if (!responseJson.ok) {
        Logger.log("❌ Telegram API trả về lỗi: " + responseJson.description);
        sendMessage("❌ Lỗi Telegram API: " + responseJson.description, { parse_mode: "Markdown" });
        return false;
      }
    } catch (e) {
      Logger.log("⚠️ Không parse được response JSON: " + e.message);
    }

    Logger.log("✅ Đã gửi biểu đồ thành công");
    return true;
  } catch (e) {
    Logger.log("❌ Lỗi export và gửi biểu đồ: " + e.message);
    Logger.log("❌ Stack trace: " + e.stack);
    sendMessage("❌ Lỗi hệ thống khi gửi biểu đồ: " + e.message, { parse_mode: "Markdown" });
    return false;
  }
}

// ✅ Helper: Phân tích ngày/tháng
function parseDate(text, command) {
  var now = new Date();
  var day = now.getDate();
  var month = now.getMonth() + 1;
  var match = text.match(new RegExp(`^${command}\\s*(\\d{1,2})?\\/?(\\d{1,2})?$`));

  if (match && match[1] && match[2]) {
    day = Number(match[1]);
    month = Number(match[2]);
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    sendMessage("*❌ Ngày hoặc tháng không hợp lệ!*", { parse_mode: "Markdown" });
    return [null, null];
  }
  return [day, month];
}

function parseMonth(text, command) {
  var now = new Date();
  var month = now.getMonth() + 1;
  var match = text.match(new RegExp(`^${command}\\s*(\\d{1,2})?$`));

  if (match && match[1]) month = Number(match[1]);
  if (month < 1 || month > 12) {
    sendMessage("*❌ Tháng không hợp lệ!*", { parse_mode: "Markdown" });
    return null;
  }
  return month;
}

// ✅ Báo cáo ngày (tính tổng ngày, lấy tổng tháng từ G2, H2)
function sendDailyReport(day, month) {
  try {
    var year = new Date().getFullYear();
    var sheet = getSheetByMonth(month, year);
    if (!sheet) return false;

    var data = sheet.getDataRange().getValues();
    var report = `*📅 Báo cáo ngày ${day}/${month}*\n\n`;
    var expenseDetails = {};
    var totalExpense = 0;
    var totalIncome = 0;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row || row.length < 5) continue;

      var dateText = row[0];
      // Chuyển đổi Date object thành string nếu cần
      if (dateText instanceof Date) {
        dateText = Utilities.formatDate(dateText, "GMT+7", "dd/MM");
      }
      if (!dateText || typeof dateText !== 'string') continue;

      var type = String(row[1] || "").trim();
      if (!type) continue;

      var categoryDetail = String(row[2] || "").trim(); // Danh mục ở cột C
      var amountValue = row[3];
      // Xử lý số tiền: có thể là số hoặc text có format
      var amount = 0;
      if (typeof amountValue === 'number') {
        amount = amountValue;
      } else if (typeof amountValue === 'string') {
        // Loại bỏ ký tự không phải số, dấu chấm, dấu phẩy
        var cleanAmount = amountValue.replace(/[^\d.,]/g, '').replace(/,/g, '');
        amount = parseFloat(cleanAmount) || 0;
      } else {
        amount = parseFloat(amountValue) || 0;
      }
      var description = String(row[4] || "").trim(); // Mô tả ở cột E

      if (isNaN(amount) || amount <= 0) continue;

      var normalizedDate = normalizeDate(dateText);
      var [rowDay, rowMonth] = normalizedDate.split("/").map(Number);
      if (rowDay !== day || rowMonth !== month) continue;

      if (type === "Chi tiêu") {
        totalExpense += amount;
        if (categoryDetail) {
          expenseDetails[categoryDetail] = (expenseDetails[categoryDetail] || 0) + amount;
        }
      } else if (type === "Thu nhập") {
        totalIncome += amount;
      }
    }

    var overallTotalIncome = sheet.getRange("G2").getValue() || 0;
    var overallTotalExpense = sheet.getRange("H2").getValue() || 0;

    if (totalExpense === 0 && totalIncome === 0) {
      report += `*📌 Không có dữ liệu chi tiêu hoặc thu nhập trong ngày.*\n\n`;
    } else if (totalExpense === 0) {
      report += `*📌 Không có chi tiêu trong ngày.*\n\n`;
    } else {
      var icons = loadCategoryCache();
      for (var category in expenseDetails) {
        var icon = icons.get(category) || "🔹";
        report += `${icon} *${category}*: ${expenseDetails[category].toLocaleString()} VNĐ\n`;
      }
      report += "\n";
    }

    report += `💰 *Tổng thu nhập ngày:* ${totalIncome.toLocaleString('vi-VN')} ₫\n` +
      `💸 *Tổng chi tiêu ngày:* ${totalExpense.toLocaleString('vi-VN')} ₫\n\n` +
      `📊 *Tổng thu nhập tháng:* ${overallTotalIncome.toLocaleString('vi-VN')} ₫\n` +
      `📉 *Tổng chi tiêu tháng:* ${overallTotalExpense.toLocaleString('vi-VN')} ₫`;

    sendMessage(report, { parse_mode: "Markdown" });
    return true;
  } catch (e) {
    Logger.log("*❌ Lỗi sendDailyReport:* " + e.message);
    sendMessage("*❌ Lỗi tạo báo cáo ngày:* " + e.message, { parse_mode: "Markdown" });
    return false;
  }
}

// ✅ Báo cáo tháng (lấy tổng từ G2, H2)
function sendMonthlyReport(month) {
  try {
    var year = new Date().getFullYear();
    var sheet = getSheetByMonth(month, year);
    if (!sheet) return false;

    var data = sheet.getDataRange().getValues();
    var totalIncome = sheet.getRange("G2").getValue() || 0;
    var totalExpense = sheet.getRange("H2").getValue() || 0;
    var expenseDetails = {};

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row || row.length < 5) continue;

      var type = String(row[1] || "").trim();
      if (!type) continue;

      var categoryDetail = String(row[2] || "").trim(); // Danh mục ở cột C
      var amountValue = row[3];
      // Xử lý số tiền: có thể là số hoặc text có format
      var amount = 0;
      if (typeof amountValue === 'number') {
        amount = amountValue;
      } else if (typeof amountValue === 'string') {
        var cleanAmount = amountValue.replace(/[^\d.,]/g, '').replace(/,/g, '');
        amount = parseFloat(cleanAmount) || 0;
      } else {
        amount = parseFloat(amountValue) || 0;
      }
      var description = String(row[4] || "").trim(); // Mô tả ở cột E

      if (type === "Chi tiêu" && !isNaN(amount) && amount > 0 && categoryDetail) {
        expenseDetails[categoryDetail] = (expenseDetails[categoryDetail] || 0) + amount;
      }
    }

    var report = `*📊 Báo cáo tháng ${month}*\n\n`;
    if (totalExpense === 0 && totalIncome === 0) {
      report += `*📌 Không có dữ liệu chi tiêu hoặc thu nhập.*`;
    } else {
      var icons = loadCategoryCache();
      for (var category in expenseDetails) {
        var icon = icons.get(category) || "❗";
        report += `${icon} *${category}*: ${expenseDetails[category].toLocaleString()} VNĐ\n`;
      }
      report += `\n📊 *Tổng thu nhập tháng:* ${totalIncome.toLocaleString('vi-VN')} ₫\n` +
        `📉 *Tổng chi tiêu tháng:* ${totalExpense.toLocaleString('vi-VN')} ₫`;
    }
    sendMessage(report, { parse_mode: "Markdown" });
    return true;
  } catch (e) {
    Logger.log("*❌ Lỗi sendMonthlyReport:* " + e.message);
    sendMessage("*❌ Lỗi tạo báo cáo tháng:* " + e.message, { parse_mode: "Markdown" });
    return false;
  }
}

// ✅ Phân tích ngày/tháng (bỏ dòng thừa trong /phantichthang, giữ nguyên /phantichngay)
function sendTextChart(month, day) {
  try {
    var year = new Date().getFullYear();
    var sheet = getSheetByMonth(month, year);
    if (!sheet) return false;

    var data = sheet.getDataRange().getValues();
    var expenseDetails = {};
    var incomeTotal = 0;
    var expenseTotal = 0;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row || row.length < 5) continue;

      var dateText = row[0];
      // Chuyển đổi Date object thành string nếu cần
      if (dateText instanceof Date) {
        dateText = Utilities.formatDate(dateText, "GMT+7", "dd/MM");
      }
      if (!dateText || typeof dateText !== 'string') continue;

      var type = String(row[1] || "").trim();
      if (!type) continue;

      var categoryDetail = String(row[2] || "").trim(); // Danh mục ở cột C
      var amountValue = row[3];
      // Xử lý số tiền: có thể là số hoặc text có format
      var amount = 0;
      if (typeof amountValue === 'number') {
        amount = amountValue;
      } else if (typeof amountValue === 'string') {
        // Loại bỏ ký tự không phải số, dấu chấm, dấu phẩy
        var cleanAmount = amountValue.replace(/[^\d.,]/g, '').replace(/,/g, '');
        amount = parseFloat(cleanAmount) || 0;
      } else {
        amount = parseFloat(amountValue) || 0;
      }

      var description = String(row[4] || "").trim(); // Mô tả ở cột E

      if (isNaN(amount) || amount <= 0) continue;

      if (day) {
        var normalizedDate = normalizeDate(dateText);
        var [rowDay, rowMonth] = normalizedDate.split("/").map(Number);
        if (rowDay !== day || rowMonth !== month) continue;
      } else {
        // Khi không có day (phantichthang), kiểm tra tháng của dữ liệu
        var normalizedDate = normalizeDate(dateText);
        var [rowDay, rowMonth] = normalizedDate.split("/").map(Number);
        if (rowMonth !== month) continue;
      }

      if (type === "Chi tiêu") {
        expenseTotal += amount;
        if (categoryDetail) {
          expenseDetails[categoryDetail] = (expenseDetails[categoryDetail] || 0) + amount;
        }
      } else if (type === "Thu nhập") {
        incomeTotal += amount;
      }
    }

    Logger.log(`sendTextChart - month: ${month}, day: ${day}, expenseTotal: ${expenseTotal}, incomeTotal: ${incomeTotal}, expenseDetails keys: ${Object.keys(expenseDetails).length}`);

    var overallTotalIncome = sheet.getRange("G2").getValue() || 0;
    var overallTotalExpense = sheet.getRange("H2").getValue() || 0;

    var chartText;
    if (day) {
      // /phantichngay: Giữ nguyên hiển thị
      chartText = `*📊 Biểu đồ chi tiêu ngày ${day}/${month}*\n\n`;
      if (expenseTotal === 0 && incomeTotal === 0) {
        chartText += `*📌 Không có dữ liệu chi tiêu hoặc thu nhập trong ngày.*\n\n`;
      } else if (expenseTotal === 0) {
        chartText += `*📌 Không có chi tiêu trong ngày.*\n\n`;
      } else {
        var icons = loadCategoryCache();
        for (var category in expenseDetails) {
          var icon = icons.get(category) || "🔹";
          var percentage = ((expenseDetails[category] / expenseTotal) * 100).toFixed(1);
          chartText += `${icon} *${category}* | ${percentage}%\n`;
        }
        chartText += "\n";
      }
      chartText += `💰 *Tổng thu nhập ngày:* ${incomeTotal.toLocaleString('vi-VN')} ₫\n` +
        `💸 *Tổng chi tiêu ngày:* ${expenseTotal.toLocaleString('vi-VN')} ₫\n\n`;
    } else {
      // /phantichthang: Bỏ phần tổng tháng thừa
      chartText = `*📊 Biểu đồ chi tiêu tháng ${month}*\n\n`;

      // Nếu không đọc được dữ liệu chi tiết nhưng có tổng từ G2, H2
      if (expenseTotal === 0 && incomeTotal === 0 && overallTotalExpense > 0) {
        // Sử dụng tổng từ G2, H2 để tính toán
        expenseTotal = overallTotalExpense;
        incomeTotal = overallTotalIncome;
        chartText += `*⚠️ Không thể đọc chi tiết theo danh mục, hiển thị tổng từ công thức.*\n\n`;
      }

      if (expenseTotal === 0 && incomeTotal === 0) {
        chartText += `*📌 Không có dữ liệu chi tiêu hoặc thu nhập trong tháng.*\n\n`;
      } else if (expenseTotal === 0) {
        chartText += `*📌 Không có chi tiêu trong tháng.*\n\n`;
      } else {
        // Chỉ hiển thị biểu đồ nếu có dữ liệu chi tiết theo danh mục
        if (Object.keys(expenseDetails).length > 0) {
          var icons = loadCategoryCache();
          for (var category in expenseDetails) {
            var icon = icons.get(category) || "🔹";
            var percentage = ((expenseDetails[category] / expenseTotal) * 100).toFixed(1);
            chartText += `${icon} *${category}* | ${percentage}%\n`;
          }
          chartText += "\n";
        } else {
          chartText += `*📌 Không thể phân tích chi tiết theo danh mục.*\n\n`;
        }
      }
    }

    // Phần tổng tháng cuối cùng (giữ nguyên cho cả hai lệnh)
    chartText += `📊 *Tổng thu nhập tháng:* ${overallTotalIncome.toLocaleString('vi-VN')} ₫\n` +
      `📉 *Tổng chi tiêu tháng:* ${overallTotalExpense.toLocaleString('vi-VN')} ₫`;

    sendMessage(chartText, { parse_mode: "Markdown" });

    // Chỉ gửi hình ảnh biểu đồ khi dùng /phantichthang (không có day)
    if (!day && expenseTotal > 0 && Object.keys(expenseDetails).length > 0) {
      sendChartImage(expenseDetails, expenseTotal, month, day);
    }

    return true;
  } catch (e) {
    Logger.log("*❌ Lỗi sendTextChart:* " + e.message);
    sendMessage("*❌ Lỗi tạo biểu đồ:* " + e.message, { parse_mode: "Markdown" });
    return false;
  }
}

// ✅ Chi tiết tháng (bỏ dòng tổng ngày thừa, lấy tổng tháng từ G2, H2)
function sendDetailedMonthlyReport(month) {
  try {
    var year = new Date().getFullYear();
    var sheet = getSheetByMonth(month, year);
    if (!sheet) return false;

    var data = sheet.getDataRange().getValues();
    var dailyTransactions = {};

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row || row.length < 5) continue;

      var date = row[0];
      // Chuyển đổi Date object thành string nếu cần
      if (date instanceof Date) {
        date = Utilities.formatDate(date, "GMT+7", "dd/MM");
      }
      var type = String(row[1] || "").trim();
      var categoryDetail = String(row[2] || "").trim(); // Danh mục ở cột C
      var amountValue = row[3];
      // Xử lý số tiền: có thể là số hoặc text có format
      var amount = 0;
      if (typeof amountValue === 'number') {
        amount = amountValue;
      } else if (typeof amountValue === 'string') {
        var cleanAmount = amountValue.replace(/[^\d.,]/g, '').replace(/,/g, '');
        amount = parseFloat(cleanAmount) || 0;
      } else {
        amount = parseFloat(amountValue) || 0;
      }
      var description = String(row[4] || "").trim(); // Mô tả ở cột E
      var note = String(row[5] || "").trim();

      if (!date || !type || !categoryDetail || isNaN(amount) || amount <= 0) continue;

      var normalizedDate = normalizeDate(date);
      var [rowDay, rowMonth] = normalizedDate.split("/").map(Number);
      if (rowMonth !== month) continue;

      dailyTransactions[normalizedDate] = dailyTransactions[normalizedDate] || [];
      var icons = loadCategoryCache();
      var icon = icons.get(categoryDetail) || "🔹";
      var entry = `${icon} *${escapeMarkdown(description)}*: ${amount.toLocaleString("vi-VN")} VNĐ`;
      if (note) entry += ` (Ghi chú: ${escapeMarkdown(note)})`;
      dailyTransactions[normalizedDate].push(entry);
    }

    var totalIncome = sheet.getRange("G2").getValue() || 0;
    var totalExpense = sheet.getRange("H2").getValue() || 0;

    if (Object.keys(dailyTransactions).length === 0) {
      sendMessage(`*📊 Chi tiết tài chính tháng ${month}*\n\n*📌 Không có dữ liệu giao dịch trong tháng ${month}.*\n\n📊 *Tổng thu nhập tháng:* ${totalIncome.toLocaleString('vi-VN')} ₫\n📉 *Tổng chi tiêu tháng:* ${totalExpense.toLocaleString('vi-VN')} ₫`, { parse_mode: "Markdown" });
      return true;
    }

    var sortedDates = Object.keys(dailyTransactions).sort(compareDates);
    var messages = [];

    // Tạo tin nhắn từ các ngày, tự động chia nhỏ nếu quá dài
    var currentMessage = `*📊 Chi tiết tài chính tháng ${month}*\n\n`;

    sortedDates.forEach((date, index) => {
      var dateSection = `*📅 Ngày ${date}*\n\n${dailyTransactions[date].join("\n")}\n\n`;
      var newMessage = currentMessage + dateSection;

      // Kiểm tra độ dài trước khi thêm ngày
      if (newMessage.length > 4000) {
        // Nếu tin nhắn hiện tại đã có nội dung, gửi nó
        if (currentMessage.length > `*📊 Chi tiết tài chính tháng ${month}*\n\n`.length) {
          messages.push(currentMessage.trim());
        }
        // Bắt đầu tin nhắn mới
        currentMessage = `*📊 Chi tiết tài chính tháng ${month} (tiếp)*\n\n` + dateSection;
      } else {
        currentMessage = newMessage;
      }
    });

    // Thêm tin nhắn cuối cùng nếu có nội dung
    if (currentMessage.trim().length > `*📊 Chi tiết tài chính tháng ${month}*\n\n`.length) {
      messages.push(currentMessage.trim());
    }

    // Thêm footer chỉ vào tin nhắn cuối cùng
    if (messages.length > 0) {
      var footer = `\n\n📊 *Tổng thu nhập tháng:* ${totalIncome.toLocaleString()} VNĐ\n` +
        `📉 *Tổng chi tiêu tháng:* ${totalExpense.toLocaleString()} VNĐ`;
      messages[messages.length - 1] += footer;
    }

    // Gửi từng tin nhắn
    messages.forEach((msg, index) => {
      sendMessage(msg, { parse_mode: "Markdown" });
    });

    return true;
  } catch (e) {
    Logger.log("*❌ Lỗi sendDetailedMonthlyReport:* " + e.message);
    sendMessage("*❌ Lỗi tạo chi tiết tháng:* " + e.message, { parse_mode: "Markdown" });
    return false;
  }
}

// ✅ Chi tiết ngày (giữ nguyên hiển thị)
function sendDetailedDailyReport(day, month) {
  try {
    var year = new Date().getFullYear();
    var sheet = getSheetByMonth(month, year);
    if (!sheet) return false;

    var data = sheet.getDataRange().getValues();
    var report = `*📅 Chi tiết tài chính ngày ${day}/${month}*\n\n`;
    var incomeTotal = 0, expenseTotal = 0;
    var expenseDetails = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row || row.length < 5) continue;

      var dateText = row[0];
      // Chuyển đổi Date object thành string nếu cần
      if (dateText instanceof Date) {
        dateText = Utilities.formatDate(dateText, "GMT+7", "dd/MM");
      }
      if (!dateText || typeof dateText !== 'string') continue;

      var type = String(row[1] || "").trim();
      if (!type) continue;

      var categoryDetail = String(row[2] || "").trim(); // Danh mục ở cột C
      var amountValue = row[3];
      // Xử lý số tiền: có thể là số hoặc text có format
      var amount = 0;
      if (typeof amountValue === 'number') {
        amount = amountValue;
      } else if (typeof amountValue === 'string') {
        var cleanAmount = amountValue.replace(/[^\d.,]/g, '').replace(/,/g, '');
        amount = parseFloat(cleanAmount) || 0;
      } else {
        amount = parseFloat(amountValue) || 0;
      }
      var description = String(row[4] || "").trim(); // Mô tả ở cột E
      var note = String(row[5] || "").trim();

      if (isNaN(amount) || amount <= 0) continue;

      var normalizedDate = normalizeDate(dateText);
      var [rowDay, rowMonth] = normalizedDate.split("/").map(Number);
      if (rowDay !== day || rowMonth !== month) continue;

      if (type === "Thu nhập") {
        incomeTotal += amount;
      } else if (type === "Chi tiêu") {
        var icons = loadCategoryCache();
        var icon = icons.get(categoryDetail) || "🔹";
        var entry = `${icon} *${escapeMarkdown(description)}*: ${amount.toLocaleString("vi-VN")} ₫`;
        if (note) entry += ` (Ghi chú: ${escapeMarkdown(note)})`;
        expenseDetails.push(entry);
        expenseTotal += amount;
      }
    }

    Logger.log("📊 sendDetailedDailyReport - day: " + day + ", month: " + month);
    Logger.log("📊 expenseDetails.length: " + expenseDetails.length + ", incomeTotal: " + incomeTotal);

    var overallTotalIncome = sheet.getRange("G2").getValue() || 0;
    var overallTotalExpense = sheet.getRange("H2").getValue() || 0;

    if (expenseDetails.length === 0 && incomeTotal === 0) {
      report += `*📌 Không có dữ liệu chi tiêu hoặc thu nhập trong ngày.*\n\n`;
    } else if (expenseDetails.length === 0) {
      report += `*📌 Không có chi tiêu trong ngày.*\n\n`;
    } else {
      report += expenseDetails.join("\n") + "\n\n";
    }

    report += `💰 *Tổng thu nhập ngày:* ${incomeTotal.toLocaleString('vi-VN')} ₫\n` +
      `💸 *Tổng chi tiêu ngày:* ${expenseTotal.toLocaleString('vi-VN')} ₫\n\n` +
      `📊 *Tổng thu nhập tháng:* ${overallTotalIncome.toLocaleString('vi-VN')} ₫\n` +
      `📉 *Tổng chi tiêu tháng:* ${overallTotalExpense.toLocaleString('vi-VN')} ₫`;

    Logger.log("📤 Sending report: " + report.substring(0, 200));
    sendMessage(report, { parse_mode: "Markdown" });
    return true;
  } catch (e) {
    Logger.log("*❌ Lỗi sendDetailedDailyReport:* " + e.message);
    sendMessage("*❌ Lỗi tạo chi tiết ngày:* " + e.message, { parse_mode: "Markdown" });
    return false;
  }
}

// ✅ Viết hoa chữ cái đầu
function capitalizeFirstLetter(string) {
  if (!string) return "";
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// ✅ Chuẩn hóa ghi chú
function capitalizeNote(note) {
  if (!note) return "";

  if (note.indexOf("(") === -1) {
    return capitalizeFirstLetter(note);
  }

  var outsideParentheses = note.substring(0, note.indexOf("(")).trim();
  var insideParentheses = note.substring(note.indexOf("(") + 1, note.indexOf(")")).trim();

  var capitalizedOutside = outsideParentheses ? capitalizeFirstLetter(outsideParentheses) : "";
  var capitalizedInside = insideParentheses;

  // Giữ nguyên định dạng gốc của chuỗi bên trong ngoặc
  capitalizedInside = capitalizeFirstLetter(insideParentheses);

  return capitalizedOutside + (insideParentheses ? " (" + capitalizedInside + ")" : "");
}

// ✅ Thông báo lỗi
function sendErrorMessage(type) {
  var message = type === "command"
    ? "*❌ Lệnh không tồn tại! Nhập /huongdan để xem danh sách lệnh.*"
    : "*❌ Sai cú pháp giao dịch! Nhập /huongdan để xem hướng dẫn.*";
  sendMessage(message, { parse_mode: "Markdown" });
}

// ✅ Hướng dẫn
function sendHelpMessage() {
  var message = `*📚 Hướng dẫn sử dụng các lệnh:*\n\n` +
    `*1. /miniapp*\n` +
    `- Xem thống kê tài chính qua giao diện miniapp (bao gồm tổng thu nhập, tổng chi tiêu, biểu đồ chi tiêu...).\n` +
    `- Ví dụ: \`/miniapp\`\n\n` +
    `*2. /danhmuc*\n` +
    `- Hiển thị danh sách tất cả danh mục phân loại.\n` +
    `- Ví dụ: \`/danhmuc\`\n\n` +
    `*3. /themtukhoa*\n` +
    `- Thêm từ khóa vào danh mục để phân loại tự động.\n` +
    `- Ví dụ: \`/themtukhoa cà phê 2\`\n` +
    `- Trong đó "cà phê" là từ khóa, "2" là số thứ tự của danh mục.\n\n` +
    `*4. /suaphanloai*\n` +
    `- Sửa phân loại giao dịch chi tiêu gần nhất trong ngày.\n` +
    `- Ví dụ: \`/suaphanloai 5\`\n` +
    `- Trong đó "5" là số thứ tự của danh mục phân loại.\n\n` +
    `*5. /suadinhdang*\n` +
    `- Sửa định dạng giao dịch (Thu nhập/Chi tiêu) gần nhất trong ngày.\n` +
    `- Ví dụ: \`/suadinhdang thu nhập\` (chuyển thành Thu nhập).\n` +
    `- Ví dụ: \`/suadinhdang chi tiêu\` (chuyển thành Chi tiêu).\n\n` +
    `*6. /baocaongay*\n` +
    `- Xem báo cáo thu chi của một ngày cụ thể.\n` +
    `- Ví dụ: \`/baocaongay\` (xem ngày hiện tại).\n` +
    `- Ví dụ: \`/baocaongay 5/3\` (xem ngày 5/3).\n\n` +
    `*7. /baocaothang*\n` +
    `- Xem báo cáo thu chi của một tháng cụ thể.\n` +
    `- Ví dụ: \`/baocaothang\` (xem tháng hiện tại).\n` +
    `- Ví dụ: \`/baocaothang 1\` (xem tháng 1).\n\n` +
    `*8. /phantichngay*\n` +
    `- Xem biểu đồ % chi tiêu theo danh mục của ngày.\n` +
    `- Ví dụ: \`/phantichngay\` (xem ngày hiện tại).\n` +
    `- Ví dụ: \`/phantichngay 5/2\` (xem ngày 5/2).\n\n` +
    `*9. /phantichthang*\n` +
    `- Xem biểu đồ % chi tiêu theo danh mục của tháng.\n` +
    `- Ví dụ: \`/phantichthang\` (xem tháng hiện tại).\n` +
    `- Ví dụ: \`/phantichthang 2\` (xem tháng 2).\n\n` +
    `*10. /chitietngay*\n` +
    `- Xem chi tiết giao dịch của một ngày.\n` +
    `- Ví dụ: \`/chitietngay\` (xem ngày hiện tại).\n` +
    `- Ví dụ: \`/chitietngay 5/3\` (xem ngày 5/3).\n\n` +
    `*11. /chitietthang*\n` +
    `- Xem chi tiết giao dịch của một tháng.\n` +
    `- Ví dụ: \`/chitietthang\` (xem tháng hiện tại).\n` +
    `- Ví dụ: \`/chitietthang 3\` (xem tháng 3).\n\n` +
    `*12. /suanoidung*\n` +
    `- Sửa nội dung (mô tả) giao dịch gần nhất trong ngày trong trường hợp sai nội dung hoặc số tiền.\n` +
    `- Lưu ý: Lệnh này có thể thay thế cho lệnh /suadinhdang khi:\n` +
    `• Số tiền có dấu "+", giao dịch sẽ được phân loại thành Thu nhập.\n` +
    `• Số tiền không có dấu "+", giao dịch sẽ được phân loại thành Chi tiêu.\n` +
    `- Ví dụ: \`/suanoidung 11/3 500k đổ dầu\` (Ngày cụ thể).\n` +
    `- Ví dụ: \`/suanoidung 50k cà phê\` (Ngày hiện tại).\n` +
    `- Ví dụ: \`/suanoidung +500k lương OT\` (Thu nhập).\n` +
    `- Ví dụ: \`/suanoidung 500k sửa xe máy\` (Chi tiêu).\n\n` +
    `*📌 Ghi giao dịch:*\n` +
    `- Thu nhập: \`+Số tiền mô tả\` (VD: \`+5m lương\`).\n` +
    `- Chi tiêu: \`Số tiền mô tả\` (VD: \`500k cà phê\`).\n` +
    `- Thêm ngày: \`Ngày/tháng số tiền mô tả\` (VD: \`5/3 500k ăn trưa\`).\n` +
    `- Ghi chú: \`Số tiền mô tả (Ghi chú)\` (VD: \`500k cà phê (gặp bạn)\`).\n\n` +
    `*Nhập lệnh bất kỳ để bắt đầu!*\n\n` +
    `*13. /scanmail*\n` +
    `- Quét email ngân hàng trong ngày và tự động tạo giao dịch.\n` +
    `- Bot sẽ hỏi ghi chú cho từng giao dịch (mỗi dòng 1 ghi chú theo thứ tự).\n` +
    `- Ví dụ: \`/scanmail\`\n`;
  sendMessage(message, { parse_mode: "Markdown" });
}

// ✅ Sửa phân loại (không ghi đè G2, H2)
function correctCategory(categoryIndex) {
  try {
    var categories = Array.from(loadCategoryCache().keys());
    if (categoryIndex < 1 || categoryIndex > categories.length) {
      sendMessage("*❌ Số thứ tự danh mục không hợp lệ!*", { parse_mode: "Markdown" });
      return false;
    }

    var newCategory = categories[categoryIndex - 1];
    var now = new Date();
    var day = String(now.getDate()).padStart(2, '0');
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var inputDate = `${day}/${month}`;
    var monthNum = parseInt(month, 10);
    var year = now.getFullYear();

    var sheet = getSheetByMonth(monthNum, year);
    if (!sheet) {
      sendMessage(`*❌ Không thể tạo sheet cho tháng ${month}/${year}.*`, { parse_mode: "Markdown" });
      return false;
    }

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      sendMessage("*❌ Không có giao dịch nào để sửa!*", { parse_mode: "Markdown" });
      return false;
    }

    var lastTransactionIndex = -1;
    var lastTransactionDate = null;
    for (var i = data.length - 1; i > 0; i--) {
      var dateText = data[i][0];
      if (typeof dateText !== 'string') continue;
      var normalizedDate = normalizeDate(dateText);
      if (normalizedDate === inputDate) {
        lastTransactionIndex = i;
        lastTransactionDate = normalizedDate;
        break;
      }
    }

    if (lastTransactionIndex === -1) {
      sendMessage("*❌ Không tìm thấy giao dịch nào trong ngày hiện tại!*", { parse_mode: "Markdown" });
      return false;
    }

    var transaction = data[lastTransactionIndex];
    // Cột C (index 2) = Danh mục (từ sheet "Từ khóa")
    transaction[2] = newCategory;
    var row = lastTransactionIndex + 1;
    sheet.getRange(row, 1, 1, transaction.length).setValues([transaction]);

    // Định dạng cột D (Số tiền) với dấu phân cách hàng nghìn
    sheet.getRange(row, 4).setNumberFormat("#,##0");

    // Áp dụng màu xanh cho số tiền thu nhập
    applyAmountColorFormatting(sheet);

    // Cập nhật biểu đồ sau khi sửa
    createOrUpdateChart(sheet);

    var type = transaction[1];
    var categoryDetail = transaction[2]; // Danh mục ở cột C
    var amount = transaction[3];
    var description = transaction[4]; // Mô tả ở cột E
    var note = transaction[5] || "";
    var icon = loadCategoryCache().get(newCategory) || "❗";
    var typeIcon = type === "Thu nhập" ? "💰" : "💸";

    var totalIncome = sheet.getRange("G2").getValue() || 0;
    var totalExpense = sheet.getRange("H2").getValue() || 0;

    var formattedAmount = amount.toLocaleString('vi-VN') + " ₫";
    var message = `*✅ Đã sửa phân loại giao dịch*\n\n` +
      `*${typeIcon} ${type}*\n` +
      `*💰 Số tiền:* ${formattedAmount}\n` +
      `*📝 Mô tả:* ${description}\n` +
      `*${icon} Danh mục:* ${newCategory}\n` +
      `*📅 Ngày:* ${lastTransactionDate}\n`;
    if (note) message += `*📌 Ghi chú:* ${note}\n`;
    message += `\n*📊 Tổng kết tháng ${month}:*\n` +
      `💰 Thu nhập: ${totalIncome.toLocaleString('vi-VN')} ₫\n` +
      `💸 Chi tiêu: ${totalExpense.toLocaleString('vi-VN')} ₫\n`;

    sendMessage(message, { parse_mode: "Markdown" });
    return true;
  } catch (e) {
    Logger.log("*❌ Lỗi correctCategory:* " + e.message);
    sendMessage("*❌ Lỗi hệ thống khi sửa phân loại:* " + e.message, { parse_mode: "Markdown" });
    return false;
  }
}

// ✅ Sửa định dạng giao dịch (không ghi đè G2, H2)
function correctType(newType) {
  try {
    var now = new Date();
    var day = String(now.getDate()).padStart(2, '0');
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var inputDate = `${day}/${month}`;
    var monthNum = parseInt(month, 10);
    var year = now.getFullYear();

    var sheet = getSheetByMonth(monthNum, year);
    if (!sheet) {
      sendMessage(`*❌ Không thể tạo sheet cho tháng ${month}/${year}.*`, { parse_mode: "Markdown" });
      return false;
    }

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      sendMessage("*❌ Không có giao dịch nào để sửa!*", { parse_mode: "Markdown" });
      return false;
    }

    var lastTransactionIndex = -1;
    var lastTransactionDate = null;
    for (var i = data.length - 1; i > 0; i--) {
      var dateText = data[i][0];
      if (typeof dateText !== 'string') continue;
      var normalizedDate = normalizeDate(dateText);
      if (normalizedDate === inputDate) {
        lastTransactionIndex = i;
        lastTransactionDate = normalizedDate;
        break;
      }
    }

    if (lastTransactionIndex === -1) {
      sendMessage("*❌ Không tìm thấy giao dịch nào trong ngày hiện tại!*", { parse_mode: "Markdown" });
      return false;
    }

    var transaction = data[lastTransactionIndex];
    var categoryDetail = transaction[2]; // Danh mục ở cột C
    var amount = transaction[3];
    var description = transaction[4]; // Mô tả ở cột E
    var note = transaction[5] || "";
    var typeIcon = newType === "Thu nhập" ? "💰" : "💸";

    transaction[1] = newType;
    var row = lastTransactionIndex + 1;
    sheet.getRange(row, 1, 1, transaction.length).setValues([transaction]);

    // Định dạng cột D (Số tiền) với dấu phân cách hàng nghìn
    sheet.getRange(row, 4).setNumberFormat("#,##0");

    // Áp dụng màu xanh cho số tiền thu nhập
    applyAmountColorFormatting(sheet);

    // Cập nhật biểu đồ sau khi sửa
    createOrUpdateChart(sheet);

    var totalIncome = sheet.getRange("G2").getValue() || 0;
    var totalExpense = sheet.getRange("H2").getValue() || 0;

    var categoryIcon = loadCategoryCache().get(categoryDetail) || "❗";
    var formattedAmount = amount.toLocaleString('vi-VN') + " ₫";
    var message = `*✅ Đã sửa định dạng giao dịch*\n\n` +
      `*${typeIcon} ${newType}*\n` +
      `*💰 Số tiền:* ${formattedAmount}\n` +
      `*📝 Mô tả:* ${escapeMarkdown(description)}\n` +
      `*${categoryIcon} Danh mục:* ${escapeMarkdown(categoryDetail)}\n` +
      `*📅 Ngày:* ${lastTransactionDate}\n`;
    if (note) message += `*📌 Ghi chú:* ${escapeMarkdown(note)}\n`;
    message += `\n*📊 Tổng kết tháng ${month}:*\n` +
      `💰 Thu nhập: ${totalIncome.toLocaleString('vi-VN')} ₫\n` +
      `💸 Chi tiêu: ${totalExpense.toLocaleString('vi-VN')} ₫\n`;

    sendMessage(message, { parse_mode: "Markdown" });
    return true;
  } catch (e) {
    Logger.log("*❌ Lỗi correctType:* " + e.message);
    sendMessage("*❌ Lỗi hệ thống khi sửa định dạng:* " + e.message, { parse_mode: "Markdown" });
    return false;
  }
}

// ✅ Thoát ký tự đặc biệt để tránh làm gián đoạn Markdown
function escapeMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/`/g, "\\`")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\n/g, "\\n"); // Thêm escape cho ký tự xuống dòng
}

// ✅ Sửa nội dung giao dịch (không ghi đè G2, H2)
function correctContent(newContent) {
  try {
    var now = new Date();
    var defaultDay = String(now.getDate()).padStart(2, '0');
    var defaultMonth = String(now.getMonth() + 1).padStart(2, '0');
    var inputDate = `${defaultDay}/${defaultMonth}`; // Ngày mặc định là hôm nay

    // Regex để xử lý cú pháp có ngày và không có ngày
    var matchWithDate = newContent.match(/^(\d{1,2}\/\d{1,2})\s+([+-]?(?:\d+(?:\.\d+)?[kKmM]?|\d+m\d+))\s+(.+?)(?:\s*\(([^()]+)\))?$/);
    var matchWithoutDate = newContent.match(/^([+-]?(?:\d+(?:\.\d+)?[kKmM]?|\d+m\d+))\s+(.+?)(?:\s*\(([^()]+)\))?$/);

    var amountText, descriptionInput, noteInput, specifiedDate;

    if (matchWithDate) {
      // Có ngày được chỉ định
      specifiedDate = normalizeDate(matchWithDate[1]);
      amountText = matchWithDate[2];
      descriptionInput = matchWithDate[3].trim();
      noteInput = matchWithDate[4] ? matchWithDate[4].trim() : "";
    } else if (matchWithoutDate) {
      // Không có ngày, dùng ngày hiện tại
      specifiedDate = inputDate;
      amountText = matchWithoutDate[1];
      descriptionInput = matchWithoutDate[2].trim();
      noteInput = matchWithoutDate[3] ? matchWithoutDate[3].trim() : "";
    } else {
      sendMessage("*❌ Sai cú pháp! Vui lòng nhập: /suanoidung [ngày/tháng] <số tiền> <mô tả> (<ghi chú>)*", { parse_mode: "Markdown" });
      return false;
    }

    // Kiểm tra ngày hợp lệ
    if (!isValidDate(specifiedDate)) {
      sendMessage("*❌ Ngày không hợp lệ! Vui lòng nhập ngày từ 01/01 đến 31/12 (ví dụ: 05/03).*", { parse_mode: "Markdown" });
      return false;
    }

    var monthNum = parseInt(specifiedDate.split("/")[1], 10);
    var now = new Date();
    var currentMonth = now.getMonth() + 1;
    var currentYear = now.getFullYear();
    // Xác định năm: nếu tháng lớn hơn tháng hiện tại, có thể là năm trước
    // Nhưng để đơn giản, dùng năm hiện tại (có thể cải thiện sau)
    var year = currentYear;

    var sheet = getSheetByMonth(monthNum, year);
    if (!sheet) {
      sendMessage(`*❌ Không thể tạo sheet cho tháng ${monthNum}/${year}.*`, { parse_mode: "Markdown" });
      return false;
    }

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      sendMessage("*❌ Không có giao dịch nào để sửa!*", { parse_mode: "Markdown" });
      return false;
    }

    // Tìm giao dịch cuối cùng
    var lastTransactionIndex = -1;
    var lastTransactionDate = null;
    var hasDateSpecified = matchWithDate !== null; // Kiểm tra xem có chỉ định ngày không

    if (hasDateSpecified) {
      // Nếu có chỉ định ngày, tìm giao dịch cuối cùng của ngày đó
      for (var i = data.length - 1; i > 0; i--) {
        var dateText = data[i][0];
        if (typeof dateText !== 'string') continue;
        var normalizedDateText = normalizeDate(dateText);
        if (normalizedDateText === specifiedDate) {
          lastTransactionIndex = i;
          lastTransactionDate = normalizedDateText;
          break;
        }
      }

      if (lastTransactionIndex === -1) {
        sendMessage(`*❌ Không tìm thấy giao dịch nào trong ngày ${specifiedDate}!*`, { parse_mode: "Markdown" });
        return false;
      }
    } else {
      // Nếu không chỉ định ngày, tìm giao dịch cuối cùng của ngày hiện tại
      // specifiedDate đã được set thành ngày hiện tại (inputDate) ở trên
      for (var i = data.length - 1; i > 0; i--) {
        var row = data[i];
        if (!row || row.length < 4) continue;
        var dateText = row[0];
        if (!dateText) continue;

        // Chuyển đổi Date object thành string nếu cần
        if (dateText instanceof Date) {
          dateText = Utilities.formatDate(dateText, "GMT+7", "dd/MM");
        }
        if (typeof dateText !== 'string') continue;

        var normalizedDateText = normalizeDate(dateText);
        // Tìm giao dịch cuối cùng của ngày hiện tại
        if (normalizedDateText === specifiedDate) {
          lastTransactionIndex = i;
          lastTransactionDate = normalizedDateText;
          Logger.log("✅ Tìm thấy giao dịch cuối cùng của ngày " + specifiedDate + " tại index " + i);
          break;
        }
      }

      if (lastTransactionIndex === -1) {
        sendMessage(`*❌ Không tìm thấy giao dịch nào trong ngày ${specifiedDate}!*`, { parse_mode: "Markdown" });
        return false;
      }

      Logger.log("✅ Sẽ sửa giao dịch tại row " + (lastTransactionIndex + 1) + " với ngày: " + specifiedDate);
    }

    var transaction = data[lastTransactionIndex].slice(0, 6);
    var existingNote = transaction[5] || "";

    var amount = parseMoney(amountText);
    if (!amount || isNaN(amount) || amount <= 0) {
      sendMessage("*❌ Số tiền không hợp lệ! Vui lòng nhập số tiền đúng format (ví dụ: 500k, 1.5m, 1m5, hoặc số nguyên).*", { parse_mode: "Markdown" });
      return false;
    }

    var description = capitalizeFirstLetter(descriptionInput);
    var originalNote = noteInput || existingNote;

    // Kiểm tra nếu noteInput chứa chữ hoa, giữ nguyên định dạng
    var note;
    if (noteInput && /[A-Z]/.test(noteInput) && noteInput.toLowerCase() !== noteInput) {
      note = capitalizeFirstLetter(noteInput); // Giữ định dạng, chỉ viết hoa đầu
      Logger.log("*⚠️ Giữ nguyên định dạng gốc của noteInput: " + note);
    } else {
      note = capitalizeNote(originalNote); // Chuẩn hóa nếu không có chữ hoa
    }

    var escapedNote = escapeMarkdown(note); // Bảo vệ chuỗi trước khi gửi

    // Ghi log giá trị note sau khi chuẩn hóa
    Logger.log("*⚠️ Giá trị note sau khi chuẩn hóa: " + note + " | Sau khi escape: " + escapedNote);

    var newType = amountText.startsWith("+") ? "Thu nhập" : "Chi tiêu";
    var typeIcon = newType === "Thu nhập" ? "💰" : "💸";

    // Cập nhật giao dịch
    // Cột C = Danh mục (từ sheet "Từ khóa", ví dụ: "Đi lại")
    // Cột E = Mô tả (từ tin nhắn người dùng, ví dụ: "Đồ xăng")
    transaction[0] = specifiedDate; // Ngày
    transaction[1] = newType; // Loại giao dịch
    transaction[2] = getCategoryDetail(description); // Danh mục (cột C)
    transaction[3] = amount; // Số tiền
    transaction[4] = description; // Mô tả (cột E)
    transaction[5] = note; // Ghi chú

    var row = lastTransactionIndex + 1;
    Logger.log("✅ Đang cập nhật giao dịch tại row " + row + " (index " + lastTransactionIndex + ") với ngày: " + specifiedDate);
    sheet.getRange(row, 1, 1, 6).setValues([transaction]);

    // Định dạng cột D (Số tiền) với dấu phân cách hàng nghìn
    sheet.getRange(row, 4).setNumberFormat("#,##0");

    // Áp dụng màu xanh cho số tiền thu nhập
    applyAmountColorFormatting(sheet);

    // Cập nhật biểu đồ sau khi sửa
    createOrUpdateChart(sheet);

    var totalIncome = sheet.getRange("G2").getValue() || 0;
    var totalExpense = sheet.getRange("H2").getValue() || 0;

    var categoryDetail = transaction[2]; // Danh mục ở cột C
    var categoryIcon = loadCategoryCache().get(categoryDetail) || "❗";
    var formattedAmount = amount.toLocaleString('vi-VN') + " ₫";
    var formatTotalIncome = totalIncome.toLocaleString('vi-VN') + " ₫";
    var formatTotalExpense = totalExpense.toLocaleString('vi-VN') + " ₫";
    var formatBalance = (totalIncome - totalExpense).toLocaleString('vi-VN') + " ₫";

    var markdownMessage = "*✅ Đã sửa nội dung giao dịch*\n\n" +
      "*" + typeIcon + " " + newType + "*\n" +
      "*💰 Số tiền:* " + formattedAmount + "\n" +
      "*📝 Mô tả:* " + escapeMarkdown(description) + "\n" +
      "*" + categoryIcon + " Danh mục:* " + escapeMarkdown(categoryDetail) + "\n" +
      "*📅 Ngày:* " + specifiedDate + "\n";
    if (escapedNote) markdownMessage += "*📌 Ghi chú:* " + escapedNote + "\n";
    markdownMessage += "\n*📊 Tổng kết tháng " + monthNum + ":*\n" +
      "💰 Thu nhập: " + formatTotalIncome + "\n" +
      "💸 Chi tiêu: " + formatTotalExpense + "\n";

    // Gửi chỉ tin nhắn Markdown
    sendMessage(markdownMessage, { parse_mode: "Markdown" });
    return true;
  } catch (e) {
    Logger.log("*❌ Lỗi correctContent:* " + e.message);
    sendMessage("*❌ Lỗi hệ thống khi sửa nội dung:* " + e.message, { parse_mode: "Markdown" });
    return false;
  }
}
// ✅ Hàm chuẩn hóa ngày
function normalizeDate(dateText) {
  if (typeof dateText !== 'string') return "01/01";
  var parts = dateText.trim().split(/[\/\-]/); // Hỗ trợ cả "dd/mm" và "dd-mm" hoặc "dd/mm/yyyy"
  if (parts.length < 2) return "01/01";
  var day = parts[0].padStart(2, '0');
  var month = parts[1].padStart(2, '0');
  return day + "/" + month;
}

// ✅ Lấy tổng quan tài chính (Thu nhập, Chi tiêu, Tiền tiết kiệm, Tiền nợ) theo khoảng thời gian
function getFinancialSummary(params) {
  try {
    var startDate = params.startDate || Utilities.formatDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "GMT+7", "yyyy-MM-dd");
    var endDate = params.endDate || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");

    var start = new Date(startDate);
    var end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    Logger.log("Received startDate: " + startDate + ", endDate: " + endDate);
    Logger.log("Converted Start: " + Utilities.formatDate(start, "GMT+7", "dd/MM/yyyy") + ", End: " + Utilities.formatDate(end, "GMT+7", "dd/MM/yyyy"));

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var totalIncome = 0;
    var totalExpense = 0;
    var expenseCategories = {};

    var startMonth = start.getMonth() + 1;
    var endMonth = end.getMonth() + 1;
    var startYear = start.getFullYear();
    var endYear = end.getFullYear();

    var currentDate = new Date(start);
    var processedSheets = new Set();

    while (currentDate <= end) {
      var month = currentDate.getMonth() + 1;
      var year = currentDate.getFullYear();
      var sheetName = getSheetNameByMonth(month, year);

      if (!processedSheets.has(sheetName)) {
        processedSheets.add(sheetName);
        // Thử tìm sheet với format mới trước, nếu không có thì thử format cũ
        var sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
          var oldSheetName = "Tháng " + String(month).padStart(2, '0');
          sheet = ss.getSheetByName(oldSheetName);
        }

        if (sheet) {
          Logger.log("Processing sheet: " + sheetName + " for year: " + year);
          var data = sheet.getDataRange().getValues();
          Logger.log("Sheet " + sheetName + " has " + data.length + " rows");

          for (var i = 1; i < data.length; i++) {
            var dateText = data[i][0];
            var type = data[i][1];
            var amount = parseFloat(data[i][3]) || 0;
            var category = data[i][2] || 'Không phân loại'; // Danh mục ở cột C

            if (!dateText || typeof dateText !== 'string' || isNaN(amount) || amount <= 0) {
              Logger.log("Row " + (i + 1) + " - Skipped: Invalid data (dateText: " + dateText + ", amount: " + amount + ")");
              continue;
            }

            var [day, monthNum] = normalizeDate(dateText).split("/").map(Number);
            // Xác định năm dựa trên tháng và khoảng thời gian
            var transactionYear = (monthNum < startMonth && year === endYear) ? endYear : startYear;
            var transactionDate = new Date(transactionYear, monthNum - 1, day);

            Logger.log("Row " + (i + 1) + " - Date in Sheet: " + dateText +
              ", Normalized: " + normalizeDate(dateText) +
              ", Transaction Date: " + Utilities.formatDate(transactionDate, "GMT+7", "dd/MM/yyyy") +
              ", Type: " + type +
              ", Amount: " + amount +
              ", Category: " + category +
              ", Range: " + Utilities.formatDate(start, "GMT+7", "dd/MM/yyyy") + " to " +
              Utilities.formatDate(end, "GMT+7", "dd/MM/yyyy"));

            if (transactionDate >= start && transactionDate <= end) {
              Logger.log("Row " + (i + 1) + " - Included in range: " + type + " - " + amount);
              if (type === "Thu nhập") {
                totalIncome += amount;
              } else if (type === "Chi tiêu") {
                totalExpense += amount;
                expenseCategories[category] = (expenseCategories[category] || 0) + amount;
              }
            } else {
              Logger.log("Row " + (i + 1) + " - Excluded from range: " + type + " - " + amount);
            }
          }
        } else {
          Logger.log("Sheet " + sheetName + " not found");
        }
      }
      currentDate.setMonth(currentDate.getMonth() + 1);
      currentDate.setDate(1);
    }

    var totalSavings = totalIncome - totalExpense;
    var netBalance = totalIncome - totalExpense;

    var expenseCategoriesArray = Object.keys(expenseCategories).map(category => ({
      category: category,
      amount: expenseCategories[category]
    }));

    var summary = {
      income: totalIncome,
      expense: totalExpense,
      savings: totalSavings > 0 ? totalSavings : 0,
      balance: netBalance,
      expenseCategories: expenseCategoriesArray
    };

    Logger.log("Summary: " + JSON.stringify(summary));
    return summary;
  } catch (error) {
    Logger.log("Error in getFinancialSummary: " + error.message);
    return { error: `Lỗi khi lấy dữ liệu: ${error.message}` };
  }
}

// ✅ Chuẩn hóa ngày
function normalizeDate(dateText) {
  if (typeof dateText !== 'string' || !dateText.trim()) return "01/01";
  var parts = dateText.trim().split(/[\/\-]/);
  if (parts.length < 2) return "01/01";
  var day = parts[0].padStart(2, '0');
  var month = parts[1].padStart(2, '0');
  return day + "/" + month;
}
// ✅ Lấy dữ liệu biểu đồ từ Google Sheets
function getChartDataFromSheet(params) {
  try {
    var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    var chartData = [];

    var startDate = new Date(params.startDate);
    var endDate = new Date(params.endDate);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    Logger.log("Processing startDate: " + Utilities.formatDate(startDate, "GMT+7", "dd/MM/yyyy") +
      ", endDate: " + Utilities.formatDate(endDate, "GMT+7", "dd/MM/yyyy"));

    // Lấy tất cả các sheet (hỗ trợ cả format mới MM-YYYY và format cũ Tháng MM)
    var allSheets = spreadsheet.getSheets();
    var processedSheets = new Set();

    allSheets.forEach(function (sheet) {
      var sheetName = sheet.getName();
      // Bỏ qua các sheet không phải sheet tháng
      if (sheetName === "Từ khóa" || sheetName === "Update Log") return;

      if (processedSheets.has(sheetName)) return;
      processedSheets.add(sheetName);
      if (sheet) {
        var dataRange = sheet.getDataRange();
        var values = dataRange.getValues();
        var headers = values[0];
        // Hỗ trợ cả tên cũ và tên mới (backward compatible)
        // Cột C = Mô tả (từ tin nhắn), Cột E = Danh mục (từ sheet "Từ khóa")
        var dateCol = headers.indexOf("Ngày") !== -1 ? headers.indexOf("Ngày") : headers.indexOf("NGÀY");
        var typeCol = headers.indexOf("Loại giao dịch") !== -1 ? headers.indexOf("Loại giao dịch") :
          (headers.indexOf("Phân loại") !== -1 ? headers.indexOf("Phân loại") : headers.indexOf("PHÂN LOẠI"));
        var amountCol = headers.indexOf("Số tiền") !== -1 ? headers.indexOf("Số tiền") : headers.indexOf("SỐ TIỀN");
        // Tìm "Danh mục" ở cột C (index 2) hoặc các tên cũ - backward compatible
        var categoryCol = headers.indexOf("Danh mục") !== -1 ? headers.indexOf("Danh mục") :
          (headers.indexOf("Nhóm phân loại") !== -1 ? headers.indexOf("Nhóm phân loại") :
            (headers.indexOf("Hạng mục") !== -1 ? headers.indexOf("Hạng mục") :
              (headers.indexOf("Phân loại chi tiết") !== -1 ? headers.indexOf("Phân loại chi tiết") :
                headers.indexOf("PHÂN LOẠI CHI TIẾT"))));

        if (dateCol === -1 || amountCol === -1 || categoryCol === -1) {
          Logger.log("Sheet " + sheetName + " thiếu cột cần thiết! Tìm thấy: " + JSON.stringify(headers));
          return;
        }

        for (var i = 1; i < values.length; i++) {
          var row = values[i];
          var dateText = row[dateCol];
          var type = row[typeCol];
          var amount = parseFloat(row[amountCol]) || 0;
          var category = row[categoryCol] || "Khác";

          // Chuyển dateText thành đối tượng Date đầy đủ để so sánh
          var [day, monthNum] = normalizeDate(dateText).split("/").map(Number);
          var year = new Date().getFullYear(); // Giả sử năm hiện tại
          var rowDate = new Date(year, monthNum - 1, day);

          // Chỉ lấy dữ liệu chi tiêu trong khoảng thời gian
          if (type === "Chi tiêu" && rowDate >= startDate && rowDate <= endDate && amount > 0) {
            chartData.push({
              category: category,
              amount: amount
            });
            Logger.log("Added data: " + category + " - " + amount + " on " + Utilities.formatDate(rowDate, "GMT+7", "dd/MM/yyyy"));
          } else {
            Logger.log("Skipped data: " + type + " - " + amount + " on " + Utilities.formatDate(rowDate, "GMT+7", "dd/MM/yyyy") +
              " (Reason: " + (type !== "Chi tiêu" ? "Type mismatch" : "Out of range or amount <= 0") + ")");
          }
        }
      } else {
        Logger.log("Sheet " + month + " not found");
      }
    });

    // Aggregate the data by category
    var aggregatedData = {};
    chartData.forEach(function (item) {
      if (!aggregatedData[item.category]) {
        aggregatedData[item.category] = 0;
      }
      aggregatedData[item.category] += item.amount;
    });

    // Get sorted list of categories
    var categories = Object.keys(aggregatedData).sort();

    // Create final chart data sorted by category
    var finalChartData = categories.map(function (category) {
      return { category: category, amount: aggregatedData[category] };
    });

    Logger.log("Final Chart Data: " + JSON.stringify(finalChartData));

    // Return the response with chartData and categories
    return { chartData: finalChartData, categories: categories };
  } catch (error) {
    Logger.log("Error in getChartDataFromSheet: " + error.message);
    return { error: "Lỗi khi lấy dữ liệu biểu đồ: " + error.message };
  }
}

// ✅ Xử lý yêu cầu từ Miniapp
function doGet(e) {
  var params = e.parameter || {};
  var action = params.action || '';

  if (action === 'getFinancialSummary') {
    var summary = getFinancialSummary(params);
    return ContentService.createTextOutput(JSON.stringify(summary))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getChartData') {
    var chartData = getChartDataFromSheet(params);
    return ContentService.createTextOutput(JSON.stringify(chartData))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getMonthlyData') {
    var year = params.year || new Date().getFullYear();
    var monthlyData = getMonthlyData(year);
    return ContentService.createTextOutput(JSON.stringify(monthlyData))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getTransactionsByDate') {
    var date = params.date || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
    var transactions = getTransactionsByDate(date);
    return ContentService.createTextOutput(JSON.stringify(transactions))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Xử lý action không hợp lệ
  return ContentService.createTextOutput(JSON.stringify({ error: "Action không hợp lệ. Các action hỗ trợ: getFinancialSummary, getChartData, getMonthlyData, getTransactionsByDate" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ✅ Gửi nút mở Miniapp
function sendMiniAppButton() {
  var scriptUrl = ScriptApp.getService().getUrl(); // Lấy URL của Google Apps Script Web App
  var sheetId = SHEET_ID; // Giả sử SHEET_ID là biến toàn cục đã định nghĩa trong GAS
  var miniAppUrl = "https://miniapp-finance-hmh.netlify.app/?api=" + encodeURIComponent(scriptUrl) + "&sheetId=" + encodeURIComponent(sheetId); // Thêm cả api và sheetId vào query string
  var payload = {
    "chat_id": TELEGRAM_CHAT_ID,
    "text": "Xem tổng quan tài chính trên Mini App",
    "reply_markup": JSON.stringify({
      "inline_keyboard": [[{
        "text": "Mở Mini App",
        "web_app": { "url": miniAppUrl }
      }]]
    })
  };
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload)
  };
  try {
    var response = UrlFetchApp.fetch("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage", options);
    Logger.log("Gửi nút Miniapp, Response: " + response.getContentText());
  } catch (e) {
    Logger.log("*❌ Lỗi sendMiniAppButton:* " + e.message);
    sendMessage("*❌ Lỗi hệ thống khi gửi nút Miniapp:* " + e.message, { parse_mode: "Markdown" });
  }
}

// ✅ Hàm lấy dữ liệu tổng thu nhập và chi tiêu theo tháng trong năm xuất biểu đồ trong miniapp
function getMonthlyData(year) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let monthlyData = [];
    for (let month = 1; month <= 12; month++) {
      monthlyData.push({ month: month, income: 0, expense: 0 });
    }

    for (let month = 1; month <= 12; month++) {
      const sheetName = getSheetNameByMonth(month, year);
      // Thử tìm sheet với format mới trước, nếu không có thì thử format cũ
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        const oldSheetName = `Tháng ${String(month).padStart(2, '0')}`;
        sheet = ss.getSheetByName(oldSheetName);
      }

      if (!sheet) {
        Logger.log(`Sheet ${sheetName} hoặc ${oldSheetName} không tồn tại`);
        continue;
      }

      const data = sheet.getDataRange().getValues();

      data.forEach((row, index) => {
        if (index === 0) return;

        let dateStr = row[0];
        const type = row[1];
        const amount = Number(row[3]);

        if (!dateStr || isNaN(amount)) {
          Logger.log(`Row ${index + 1} in ${sheetName} skipped: Invalid data (dateStr: ${dateStr}, amount: ${amount})`);
          return;
        }

        if (typeof dateStr !== 'string') {
          if (dateStr instanceof Date) {
            dateStr = Utilities.formatDate(dateStr, "GMT+7", "dd/MM");
          } else {
            Logger.log(`Row ${index + 1} in ${sheetName} skipped: dateStr is not a string or Date (value: ${dateStr})`);
            return;
          }
        }

        const dateParts = dateStr.split('/');
        if (dateParts.length !== 2) {
          Logger.log(`Row ${index + 1} in ${sheetName} skipped: Invalid date format (dateStr: ${dateStr})`);
          return;
        }

        const [day, monthInDate] = dateParts.map(Number);
        if (isNaN(day) || isNaN(monthInDate) || monthInDate < 1 || monthInDate > 12 || day < 1 || day > 31) {
          Logger.log(`Row ${index + 1} in ${sheetName} skipped: Invalid date values (day: ${day}, month: ${monthInDate})`);
          return;
        }

        // Giả định năm là year được truyền vào
        // TODO: Nếu sheet có cột năm, cần kiểm tra năm thực tế của giao dịch
        const date = new Date(year, monthInDate - 1, day);

        if (date.getFullYear() == year) {
          const monthIndex = date.getMonth();
          if (type === "Thu nhập") {
            monthlyData[monthIndex].income += amount;
          } else if (type === "Chi tiêu") {
            monthlyData[monthIndex].expense += amount;
          }
        }
      });
    }

    Logger.log(`Monthly Data for ${year}: ${JSON.stringify(monthlyData)}`);
    return monthlyData;
  } catch (error) {
    Logger.log("Error in getMonthlyData: " + error.message);
    return { error: "Lỗi khi lấy dữ liệu: " + error.message };
  }
}
// ✅ Hàm thống kê chi tiêu trong ngày trong Miniapps
function getTransactionsByDate(date) {
  var selectedDate = new Date(date);
  var month = selectedDate.getMonth() + 1;
  var day = selectedDate.getDate();
  var year = selectedDate.getFullYear();

  var sheetName = getSheetNameByMonth(month, year);
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  // Thử tìm sheet với format mới trước, nếu không có thì thử format cũ
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    var oldSheetName = "Tháng " + (month < 10 ? "0" + month : month);
    sheet = spreadsheet.getSheetByName(oldSheetName);
  }

  if (!sheet) {
    Logger.log("Sheet not found: " + sheetName);
    return { error: `Sheet '${sheetName}' không tồn tại.` };
  }

  var data = sheet.getDataRange().getValues();

  var filteredData = data.slice(1).filter(row => {
    var dateStr = row[0];
    if (!dateStr || typeof dateStr !== "string") return false;

    var parts = dateStr.split("/");
    if (parts.length !== 2) return false;

    var rowDay = parseInt(parts[0], 10);
    var rowMonth = parseInt(parts[1], 10);

    return rowDay === day && rowMonth === month;
  });

  var transactions = filteredData.map(row => ({
    date: day + "/" + (month < 10 ? "0" + month : month) + "/" + year,
    type: row[1],
    category: row[2], // Danh mục ở cột C
    amount: parseFloat(row[3]) || 0,
    content: row[4], // Mô tả ở cột E
    note: row[5] || ""
  }));

  Logger.log("Transactions found: " + JSON.stringify(transactions));
  return transactions.slice(0, 10);
}

// ✅ Đổi tên và đổi vị trí cột C và E trong tất cả sheet tháng (chạy một lần để cập nhật)
// Cột C (index 2): "Danh mục" (categoryDetail - từ sheet "Từ khóa", ví dụ: "Đi lại")
// Cột E (index 4): "Mô tả" (description - từ tin nhắn người dùng, ví dụ: "Đồ xăng")
function renameSheetColumns() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var months = ["Tháng 01", "Tháng 02", "Tháng 03", "Tháng 04", "Tháng 05", "Tháng 06",
      "Tháng 07", "Tháng 08", "Tháng 09", "Tháng 10", "Tháng 11", "Tháng 12"];

    var updatedCount = 0;
    var skippedCount = 0;

    months.forEach(function (sheetName) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        Logger.log("⚠️ Sheet '" + sheetName + "' không tồn tại, bỏ qua");
        skippedCount++;
        return;
      }

      var data = sheet.getDataRange().getValues();
      if (data.length === 0) {
        Logger.log("⚠️ Sheet '" + sheetName + "' trống, bỏ qua");
        skippedCount++;
        return;
      }

      var headerRow = data[0];
      var needsUpdate = false;

      // Kiểm tra xem đã được cập nhật chưa (header mới: "Danh mục" ở cột C, "Mô tả" ở cột E)
      var isAlreadyUpdated = headerRow[2] === "Danh mục" && headerRow[4] === "Mô tả";

      if (isAlreadyUpdated) {
        Logger.log("✓ Sheet '" + sheetName + "' đã được cập nhật, bỏ qua");
        return;
      }

      // Đổi vị trí và tên cột
      // Cấu trúc cũ: [Ngày, Loại giao dịch, Mô tả/Danh mục, Số tiền, Phân loại chi tiết/Danh mục, Ghi chú]
      // Cấu trúc mới: [Ngày, Loại giao dịch, Danh mục, Số tiền, Mô tả, Ghi chú]
      // Cột C = Danh mục (từ sheet "Từ khóa"), Cột E = Mô tả (từ tin nhắn)

      var newData = [];

      // Header mới
      var newHeaders = [
        headerRow[0] || "Ngày",
        headerRow[1] === "Phân loại" ? "Loại giao dịch" : (headerRow[1] || "Loại giao dịch"),
        "Danh mục", // Cột C mới (danh mục từ sheet "Từ khóa")
        headerRow[3] || "Số tiền",
        "Mô tả", // Cột E mới (mô tả từ tin nhắn)
        headerRow[5] || "Ghi chú"
      ];
      newData.push(newHeaders);

      // Đổi vị trí dữ liệu: swap cột C và E
      // - Cột C cũ (mô tả/description) -> Cột E mới
      // - Cột E cũ (danh mục/categoryDetail) -> Cột C mới
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var newRow = [
          row[0], // Ngày
          row[1], // Loại giao dịch
          row[4] || "", // Danh mục (từ cột E cũ -> cột C mới)
          row[3], // Số tiền
          row[2] || "", // Mô tả (từ cột C cũ -> cột E mới)
          row[5] || "" // Ghi chú
        ];
        newData.push(newRow);
      }

      // Ghi lại toàn bộ dữ liệu
      if (newData.length > 0) {
        sheet.getRange(1, 1, newData.length, 6).setValues(newData);
        updatedCount++;
        Logger.log("✅ Đã cập nhật sheet: " + sheetName + " (" + (newData.length - 1) + " dòng dữ liệu)");
      }
    });

    var summary = "✅ Hoàn tất đổi tên và vị trí cột:\n" +
      "📊 Đã cập nhật: " + updatedCount + " sheet\n" +
      "⏭️ Bỏ qua: " + skippedCount + " sheet";
    Logger.log(summary);
    return summary;
  } catch (e) {
    Logger.log("❌ Lỗi renameSheetColumns: " + e.message);
    return "❌ Lỗi: " + e.message;
  }
}

// ✅ Ghi log lỗi vào Google Sheet
function logErrorToSheet(errorType, errorMessage, functionName, details) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheetName = "System Logs";
    var sheet = ss.getSheetByName(sheetName);
    
    // Tạo sheet nếu chưa có
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(["Thời gian", "Loại lỗi", "Hàm xảy ra lỗi", "Thông báo lỗi", "Chi tiết/Payload"]);
      sheet.getRange("A1:E1").setFontWeight("bold").setBackground("#f3f3f3");
      sheet.setColumnWidth(1, 150); // Thời gian
      sheet.setColumnWidth(2, 150); // Loại lỗi
      sheet.setColumnWidth(3, 150); // Hàm
      sheet.setColumnWidth(4, 300); // Lỗi
      sheet.setColumnWidth(5, 400); // Chi tiết
    }
    
    var timestamp = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
    sheet.appendRow([timestamp, errorType, functionName, errorMessage, typeof details === 'string' ? details : JSON.stringify(details)]);
  } catch (e) {
    Logger.log("❌ Lỗi khi ghi log vào sheet: " + e.message);
  }
}

// ✅ Gửi tin nhắn Telegram
function sendMessage(text, options = { parse_mode: null }) {
  var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage";
  var payload = { "chat_id": TELEGRAM_CHAT_ID, "text": text };
  if (options.parse_mode) {
    payload.parse_mode = options.parse_mode;
  }
  var requestOptions = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  try {
    var response = UrlFetchApp.fetch(url, requestOptions);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    
    if (responseCode !== 200) {
      Logger.log("*❌ Lỗi sendMessage HTTP " + responseCode + ":* " + responseText + " | Payload: " + JSON.stringify(payload));
      logErrorToSheet("Telegram API Error", responseText, "sendMessage", JSON.stringify(payload));
      
      // Thử gửi lại dạng raw text nếu lỗi liên quan tới parse_mode (chứa từ parse, entities, markdown)
      if (options.parse_mode && (responseText.includes("parse") || responseText.includes("entities") || responseText.includes("Bad Request"))) {
        var fallbackPayload = { 
          "chat_id": TELEGRAM_CHAT_ID, 
          "text": "❌ *Có lỗi định dạng tin nhắn.* ❌",
          "parse_mode": "Markdown"
        };
        var fallbackOptions = {
          "method": "post",
          "contentType": "application/json",
          "payload": JSON.stringify(fallbackPayload),
          "muteHttpExceptions": true
        };
        UrlFetchApp.fetch(url, fallbackOptions);
      }
    } else {
      Logger.log("*✅ Gửi tin nhắn thành công. Response:* " + responseText);
    }
  } catch (e) {
    Logger.log("*❌ Lỗi Network sendMessage:* " + e.message + " | Payload: " + JSON.stringify(payload));
    logErrorToSheet("Network Error", e.message, "sendMessage", JSON.stringify(payload));
  }
}