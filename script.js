const STORAGE_KEY = "tarragona_fiestas_v1";

const form = document.getElementById("eventForm");
const cedulaInput = document.getElementById("cedula");
const invitadosInput = document.getElementById("invitados");
const horasInput = document.getElementById("horas");
const formMessage = document.getElementById("formMessage");
const searchInput = document.getElementById("searchInput");
const confirmDialog = document.getElementById("confirmDialog");

let events = loadEvents();
let pendingDelete = null;

function loadEvents() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function money(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0
  }).format(value);
}

function getRate(guests) {
  if (guests <= 100) return 8000;
  if (guests <= 500) return 6000;
  return 4000;
}

function getFee(hours) {
  if (hours <= 3) return 100000;
  if (hours <= 6) return 200000;
  return 300000;
}

function getDurationRange(hours) {
  if (hours <= 3) return "1–3 horas";
  if (hours <= 6) return "4–6 horas";
  return "Más de 6 horas";
}

function updatePreview() {
  const guests = Number(invitadosInput.value);
  const hours = Number(horasInput.value);
  document.getElementById("ratePreview").textContent =
    Number.isInteger(guests) && guests > 0 ? money(getRate(guests)) + " por invitado" : "Se calcula automáticamente";
  document.getElementById("feePreview").textContent =
    Number.isInteger(hours) && hours > 0 ? money(getFee(hours)) : "Se calcula automáticamente";
}

invitadosInput.addEventListener("input", updatePreview);
horasInput.addEventListener("input", updatePreview);

form.addEventListener("submit", function (event) {
  event.preventDefault();
  const cedula = cedulaInput.value.trim();
  const guests = Number(invitadosInput.value);
  const hours = Number(horasInput.value);

  if (!cedula || !/^[0-9. -]{5,20}$/.test(cedula)) {
    showMessage("Ingresa una cédula válida (solo números, espacios, puntos o guiones).", true);
    cedulaInput.focus();
    return;
  }
  if (!Number.isInteger(guests) || guests < 1) {
    showMessage("La cantidad de invitados debe ser un número entero mayor que cero.", true);
    invitadosInput.focus();
    return;
  }
  if (!Number.isInteger(hours) || hours < 1) {
    showMessage("La duración debe ser un número entero de horas mayor que cero.", true);
    horasInput.focus();
    return;
  }

  const rate = getRate(guests);
  const fee = getFee(hours);
  const record = {
    id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    cedula, invitados: guests, horas: hours, tarifa: rate, cuota: fee,
    total: guests * rate + fee, fecha: new Date().toISOString()
  };

  events.unshift(record);
  saveEvents();
  render();
  form.reset();
  updatePreview();
  showMessage("Fiesta calculada y guardada correctamente.", false);
});

function showMessage(message, isError) {
  formMessage.textContent = message;
  formMessage.className = isError ? "message error" : "message";
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const visibleEvents = events.filter(item => item.cedula.toLowerCase().includes(query));
  const tbody = document.getElementById("eventsTable");

  if (visibleEvents.length === 0) {
    const message = events.length === 0
      ? "Aún no hay fiestas registradas. Completa el formulario para comenzar."
      : "No se encontraron fiestas con esa cédula.";
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${message}</td></tr>`;
  } else {
    tbody.innerHTML = visibleEvents.map(item => `
      <tr>
        <td>${escapeHTML(item.cedula)}</td>
        <td>${item.invitados.toLocaleString("es-CO")}</td>
        <td>${item.horas}</td>
        <td>${money(item.tarifa)}</td>
        <td>${money(item.cuota)}</td>
        <td class="money-cell">${money(item.total)}</td>
        <td><button class="delete-one" type="button" data-delete="${escapeHTML(item.id)}" aria-label="Borrar fiesta de cédula ${escapeHTML(item.cedula)}">Borrar</button></td>
      </tr>`).join("");
  }

  tbody.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => askDelete(button.dataset.delete, false));
  });

  const totalGuests = events.reduce((sum, item) => sum + item.invitados, 0);
  const totalHours = events.reduce((sum, item) => sum + item.horas, 0);
  const totalMoney = events.reduce((sum, item) => sum + item.total, 0);
  document.getElementById("statEvents").textContent = events.length.toLocaleString("es-CO");
  document.getElementById("statGuests").textContent = totalGuests.toLocaleString("es-CO");
  document.getElementById("statHours").textContent = totalHours.toLocaleString("es-CO");
  document.getElementById("statMoney").textContent = money(totalMoney);
  document.getElementById("countShort").textContent = events.filter(item => item.horas <= 3).length;
  document.getElementById("countMedium").textContent = events.filter(item => item.horas >= 4 && item.horas <= 6).length;
  document.getElementById("countLong").textContent = events.filter(item => item.horas > 6).length;
  document.getElementById("visibleCount").textContent = `${visibleEvents.length} de ${events.length} registros`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function askDelete(id, all) {
  pendingDelete = all ? "all" : id;
  document.getElementById("dialogTitle").textContent = all ? "¿Borrar todo el historial?" : "¿Borrar esta fiesta?";
  document.getElementById("dialogText").textContent = all
    ? "Se eliminarán todos los eventos guardados en este navegador. Esta acción no se puede deshacer."
    : "Este registro se eliminará y los acumulados se actualizarán. Esta acción no se puede deshacer.";
  confirmDialog.showModal();
}

confirmDialog.addEventListener("close", function () {
  if (confirmDialog.returnValue !== "confirm" || pendingDelete === null) {
    pendingDelete = null;
    return;
  }
  if (pendingDelete === "all") {
    events = [];
  } else {
    events = events.filter(item => item.id !== pendingDelete);
  }
  saveEvents();
  render();
  showMessage("Los cambios se guardaron correctamente.", false);
  pendingDelete = null;
});

document.getElementById("deleteAllBtn").addEventListener("click", function () {
  if (events.length === 0) {
    showMessage("No hay registros para borrar.", true);
    return;
  }
  askDelete(null, true);
});

searchInput.addEventListener("input", render);

render();
updatePreview();
