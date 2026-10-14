// Swipe-to-delete for transaction rows, iOS Mail style. A short swipe
// reveals a Delete button; a long swipe deletes straight away. Vertical
// scrolling still works because rows use `touch-action: pan-y`.

const REVEAL = 88;
let openRow = null;
let suppressClickUntil = 0;

// The red Delete layer only shows while a row is moved, so it can't bleed
// through the list's rounded corners.
function setX(row, x) {
  row.style.transform = x ? `translateX(${x}px)` : '';
  const wrap = row.parentElement;
  clearTimeout(wrap.swipeTimer);
  if (x) wrap.classList.add('is-swiping');
  else wrap.swipeTimer = setTimeout(() => wrap.classList.remove('is-swiping'), 300);
}

export function closeOpenRow() {
  if (openRow) setX(openRow, 0);
  openRow = null;
}

/**
 * Enables swiping on `.swipe` rows inside `container`.
 * Row markup: <div class="swipe" data-id> <div class="swipe-actions">…</div> <button class="list-row">… </div>
 */
export function enableSwipe(container, { onDelete }) {
  let drag = null;

  if (!enableSwipe.outsideListener) {
    // A tap anywhere outside the open row closes it.
    enableSwipe.outsideListener = (e) => {
      if (openRow && !openRow.parentElement.contains(e.target)) closeOpenRow();
    };
    document.addEventListener('pointerdown', enableSwipe.outsideListener, true);
  }

  container.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const row = e.target.closest('.swipe > .list-row');
    if (!row) return;
    drag = {
      row,
      id: row.parentElement.dataset.id,
      startX: e.clientX,
      startY: e.clientY,
      base: row === openRow ? -REVEAL : 0,
      x: 0,
      active: false,
      pointerId: e.pointerId,
    };
  });

  container.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        drag = null; // it's a scroll
        return;
      }
      if (Math.abs(dx) < 10) return;
      drag.active = true;
      drag.row.setPointerCapture(e.pointerId);
      drag.row.classList.add('is-dragging');
      drag.row.parentElement.classList.add('is-swiping');
    }
    let x = Math.min(0, drag.base + dx);
    const width = drag.row.offsetWidth;
    if (x < -width) x = -width;
    drag.x = x;
    setX(drag.row, x);
  });

  const end = (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { row, id, active, x } = drag;
    drag = null;
    if (!active) return;
    suppressClickUntil = Date.now() + 400;
    row.classList.remove('is-dragging');
    const width = row.offsetWidth;
    if (e.type !== 'pointercancel' && x < -width * 0.5) {
      setX(row, -width);
      openRow = null;
      setTimeout(() => onDelete(id), 180);
    } else if (e.type !== 'pointercancel' && x < -REVEAL / 2) {
      setX(row, -REVEAL);
      openRow = row;
    } else {
      setX(row, 0);
      if (openRow === row) openRow = null;
    }
  };
  container.addEventListener('pointerup', end);
  container.addEventListener('pointercancel', end);

  // Runs before other click handlers on the container: swallows the click that
  // ends a swipe, and a tap on another row while one is open just closes it.
  container.addEventListener(
    'click',
    (e) => {
      const deleteBtn = e.target.closest('.swipe-delete');
      if (deleteBtn) {
        e.stopPropagation();
        openRow = null;
        onDelete(deleteBtn.closest('.swipe').dataset.id);
        return;
      }
      if (Date.now() < suppressClickUntil) {
        e.stopPropagation();
        e.preventDefault();
      } else if (openRow && e.target.closest('.swipe > .list-row')) {
        e.stopPropagation();
        e.preventDefault();
        closeOpenRow();
      }
    },
    true,
  );
}
