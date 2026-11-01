// 抽卡记录的通用纯函数(不依赖 electron,便于单测)

// 把 fromTimeZone 时区的本地时间串换算成 toTimeZone 时区的本地时间串
const convertTimeZone = (dateTimeStr, fromTimeZoneOffset, toTimeZoneOffset) => {
  let date = new Date(dateTimeStr.replace(' ', 'T') + 'Z');
  let utcDate = new Date(date.getTime() - fromTimeZoneOffset * 60 * 60 * 1000);
  let targetDate = new Date(utcDate.getTime() + toTimeZoneOffset * 60 * 60 * 1000);
  let year = targetDate.getUTCFullYear();
  let month = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  let day = String(targetDate.getUTCDate()).padStart(2, '0');
  let hours = String(targetDate.getUTCHours()).padStart(2, '0');
  let minutes = String(targetDate.getUTCMinutes()).padStart(2, '0');
  let seconds = String(targetDate.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

module.exports = { convertTimeZone }
