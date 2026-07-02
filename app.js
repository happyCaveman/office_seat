// 1. Supabase 초기화 설정 (변수 이름을 supabaseClient로 변경)
const SUPABASE_URL = "https://wqspkvidatoovxuwxgjk.supabase.co"; // 👈 내 프로젝트 URL 넣기
const SUPABASE_KEY = "sb_publishable_m9AqBfMruC9L_5MHKjs9IQ_XyiTNtBj";    // 👈 내 게시 가능 키 넣기

// ⭐️ 전역 변수 이름을 변경하여 충돌을 막습니다.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const mapContainer = document.getElementById('mapContainer');

// 2. 페이지가 로드되면 실행할 초기화 함수
async function init() {
  await renderSeats();      
  await fetchSeatData();    
  listenToChanges();        
}

// 3. 화면에 20개의 좌석 버튼을 동적으로 생성
async function renderSeats() {
  mapContainer.innerHTML = '';
  for (let i = 1; i <= 20; i++) {
    const seatBtn = document.createElement('button');
    seatBtn.classList.add('seat');
    seatBtn.setAttribute('data-id', i);
    seatBtn.innerHTML = `<span class="seat-num">${i}</span><span class="user-name">빈 좌석</span>`;
    
    seatBtn.addEventListener('click', () => handleSeatClick(i));
    
    mapContainer.appendChild(seatBtn);
  }
}

// 4. Supabase DB에서 좌석 정보를 긁어와 화면에 뿌려주는 함수
async function fetchSeatData() {
  // ⭐️ 여기도 supabase 대신 supabaseClient 사용
  const { data: seats, error } = await supabaseClient
    .from('seats')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('데이터를 가져오는데 실패했습니다:', error);
    return;
  }

  seats.forEach(seat => {
    const seatElement = document.querySelector(`.seat[data-id="${seat.id}"]`);
    if (!seatElement) return;

    const nameElement = seatElement.querySelector('.user-name');
    
    if (seat.user_name) {
      seatElement.classList.add('occupied');
      nameElement.innerText = seat.user_name;
    } else {
      seatElement.classList.remove('occupied');
      nameElement.innerText = '빈 좌석';
    }
  });
}

// 5. 좌석 클릭 시 발생하는 핵심 이벤트 인터랙션
async function handleSeatClick(seatId) {
  // ⭐️ 여기도 supabaseClient 사용
  const { data: seat, error } = await supabaseClient
    .from('seats')
    .select('*')
    .eq('id', seatId)
    .single();

  if (error || !seat) return;

  if (!seat.user_name) {
    const name = prompt('이름을 입력하세요:');
    if (!name) return; 
    
    const password = prompt('본인 확인용 숫자 4자리 비밀번호를 입력하세요:');
    if (!password) return;
    
    if (!/^\d{4}$/.test(password)) {
      alert('비밀번호는 반드시 숫자 4자리여야 합니다!');
      return;
    }

    // ⭐️ 여기도 supabaseClient 사용
    const { error: updateError } = await supabaseClient
      .from('seats')
      .update({ user_name: name, seat_password: password, updated_at: new Date() })
      .eq('id', seatId);

    if (updateError) {
      alert('등록 중 오류가 발생했습니다.');
      console.error(updateError);
    } else {
      alert(`${name}님, ${seatId}번 좌석에 등록되었습니다.`);
    }

  } 
  else {
    const action = confirm(`현재 [${seat.user_name}]님이 예약 중인 좌석입니다.\n이 좌석을 비우시겠습니까?`);
    if (!action) return;

    const inputPassword = prompt('등록했던 숫자 4자리 비밀번호를 입력하세요:');
    if (!inputPassword) return;

    if (seat.seat_password !== inputPassword) {
      alert('비밀번호가 일치하지 않습니다. 타인의 좌석은 수정/삭제할 수 없습니다!');
      return;
    }

    // ⭐️ 여기도 supabaseClient 사용
    const { error: clearError } = await supabaseClient
      .from('seats')
      .update({ user_name: null, seat_password: null, updated_at: new Date() })
      .eq('id', seatId);

    if (clearError) {
      alert('초기화 중 오류가 발생했습니다.');
    } else {
      alert('좌석 예약이 정상적으로 취소되었습니다.');
    }
  }
}

// 6. 실시간(Realtime) 이벤트 리스너
function listenToChanges() {
  // ⭐️ 여기도 supabaseClient 사용
  supabaseClient
    .channel('schema-db-changes')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'seats' },
      (payload) => {
        console.log('DB 변경 감지됨!', payload.new);
        fetchSeatData(); 
      }
    )
    .subscribe();
}

init();