(() => {
  const sheet = document.querySelector('[data-worksheet-id="EP94"]');
  if (!sheet) return;
  const field = id => document.getElementById('ep94-' + id);
  const number = id => {
    const input = field(id);
    return input.value !== '' && input.validity.valid && Number.isFinite(input.valueAsNumber) && Math.abs(input.valueAsNumber) <= Number.MAX_SAFE_INTEGER ? input.valueAsNumber : null;
  };
  // UTC arithmetic treats these local calendar entries consistently, including across DST.
  const date = id => {
    const input = field(id);
    if (!input.value || !input.validity.valid) return null;
    const value = Date.parse(input.value + 'Z');
    return Number.isFinite(value) ? value : null;
  };
  const format = value => Number.isFinite(value) && value >= 0 && value <= 253402300799999
    ? new Date(value).toISOString().slice(0,16).replace('T',' ').replaceAll('-','/') : '';
  const put = (id,value) => { field(id).value = value; };
  const ceilMinutes = value => Math.ceil(value - 1e-9);
  const update = () => {
    for (const kind of ['work','money','time']) field(kind+'-legacy').hidden = !field(kind+'-backup').value;
    for (const input of sheet.querySelectorAll('input[type="number"]')) input.setAttribute('aria-invalid',String(!input.validity.valid || (input.value !== '' && number(input.id.slice(5)) === null)));
    const hours=number('work-hours'), due=date('work-due');
    const mode=sheet.querySelector('[name="ep94-work-mode"]:checked')?.value;
    const ratio=number('work-percent'), bufferHours=number('work-buffer-hours');
    const buffer=mode==='percent' && hours!==null && ratio!==null ? ceilMinutes(hours*60*ratio/100)
      : mode==='hours' && bufferHours!==null ? ceilMinutes(bufferHours*60) : null;
    const finish=due!==null && hours!==null && buffer!==null ? due-buffer*60000 : null;
    put('work-finish',finish===null?'':format(finish));
    put('work-start',finish===null?'':format(finish-ceilMinutes(hours*60)*60000));
    const income=number('money-income'), percent=number('money-percent');
    const reserve=income!==null && percent!==null ? Math.round((income/100*percent)*100)/100 : null;
    put('money-reserve',reserve===null?'':String(reserve));
    put('money-limit',reserve===null?'':String(Math.floor(income-reserve+1e-9)));
    const arrival=date('time-arrival'), minutes=number('time-minutes'), extra=number('time-percent');
    const total=minutes!==null && extra!==null ? ceilMinutes(minutes*(1+extra/100)) : null;
    put('time-total',total===null||!Number.isFinite(total)?'':String(total));
    put('time-depart',arrival===null||total===null?'':format(arrival-total*60000));
  };
  sheet.addEventListener('input',update,true);
  sheet.addEventListener('change',update,true);
  document.querySelector('[data-clear]').addEventListener('click',update);
  update();
})();
