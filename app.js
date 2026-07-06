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

// 3. 화면에 좌석 버튼을 동적으로 생성
async function renderSeats() {
  // ⭕ 중요: 검색용 딤드 막(#searchOverlay)이나 회의실(.room) 박스는 건드리지 않고, 기존 좌석(.seat)만 쏙 골라서 지웁니다.
  const existingSeats = mapContainer.querySelectorAll('.seat');
  existingSeats.forEach(seat => seat.remove());

  // 총 83개의 좌석을 만듭니다.
  for (let i = 1; i <= 83; i++) {
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

    const { error: updateError } = await supabaseClient
      .from('seats')
      .update({ user_name: name, seat_password: password, updated_at: new Date() })
      .eq('id', seatId);

    if (updateError) {
      alert('등록 중 오류가 발생했습니다.');
      console.error(updateError);
    } else {
      alert(`${name}님, 좌석이 등록되었습니다.`);
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

// 🌟 7. [새로 추가] 팀원 검색 기능 로직
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchOverlay = document.getElementById('searchOverlay');

// 검색 실행 함수
function executeSearch() {
  const query = searchInput.value.trim().toLowerCase(); // 앞뒤 공백 제거 및 소문자 변환
  
  if (!query) {
    alert('검색할 이름을 입력해주세요!');
    return;
  }

  let found = false;
  const allSeats = document.querySelectorAll('.seat');

  // 새로운 검색을 위해 기존에 강조되어 있던 좌석 스타일 모두 초기화
  allSeats.forEach(seat => seat.classList.remove('highlight'));
  searchOverlay.style.display = 'none';

  // 83개의 좌석 버튼을 돌면서 등록된 이름과 검색어가 일치하는지 확인
  allSeats.forEach(seat => {
    const userNameElement = seat.querySelector('.user-name');
    if (userNameElement && userNameElement.innerText.toLowerCase() === query) {
      seat.classList.add('highlight'); // 👈 CSS에 등록해둔 스포트라이트 효과 부여
      found = true;
    }
  });

  if (found) {
    // 일치하는 팀원을 찾았다면 주변을 어둡게 만드는 투명 막을 켭니다.
    searchOverlay.style.display = 'block';
  } else {
    alert(`'${query}' 님은 현재 자리에 등록되어 있지 않습니다.`);
  }
}

// 🔍 돋보기 버튼 클릭할 때 검색 실행
searchBtn.addEventListener('click', executeSearch);

// ⌨️ 검색창에서 엔터(Enter) 키를 눌렀을 때도 검색 실행
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    executeSearch();
  }
});

// 🕶️ 배경(어두운 투명 막)을 마우스로 클릭하면 강조 모드 해제
searchOverlay.addEventListener('click', () => {
  const allSeats = document.querySelectorAll('.seat');
  allSeats.forEach(seat => seat.classList.remove('highlight')); // 강조 제거
  searchOverlay.style.display = 'none'; // 어두운 막 숨기기
  searchInput.value = ''; // 검색 텍스트창 비우기
});

init();