function* slotsIter() {
  const slotMinutes = 30;
  const slotStart = '11:00', slotEnd = '22:00';
  
  // Parse time properly
  const [startHour, startMin] = slotStart.split(':').map(Number);
  const [endHour, endMin] = slotEnd.split(':').map(Number);
  
  let currentHour = startHour;
  let currentMin = startMin;
  
  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    const hh = String(currentHour).padStart(2,'0');
    const mm = String(currentMin).padStart(2,'0');
    yield `${hh}:${mm}`;
    
    // Add slot minutes
    currentMin += slotMinutes;
    if (currentMin >= 60) {
      currentHour += Math.floor(currentMin / 60);
      currentMin = currentMin % 60;
    }
  }
}

console.log('Generating slots...');
const slots = [];
for (const slot of slotsIter()) {
  slots.push(slot);
}
console.log('Total slots:', slots.length);
console.log('First 5:', slots.slice(0, 5));
console.log('Last 5:', slots.slice(-5));
console.log('18:00-21:00 slots:', slots.filter(s => s >= '18:00' && s <= '21:00'));