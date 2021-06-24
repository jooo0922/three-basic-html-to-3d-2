'use strict';

// optimiazing(요소 최적화)에서 사용했던 코드들을 활용한 예제이므로, 필요 시 해당 예제를 참고할 것.

import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/build/three.module.js';

import {
  OrbitControls
} from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/controls/OrbitControls.js';

import {
  GUI
} from 'https://threejsfundamentals.org/threejs/../3rdparty/dat.gui.module.js';

function main() {
  // create WebGLRenderer
  const canvas = document.querySelector('#canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas
  });

  // create camera
  const fov = 60;
  const aspect = 2;
  const near = 0.1;
  const far = 10;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.z = 2.5;

  // create OrbitControls
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; // 카메라 이동 시 관성(inertia) 효과를 줌.
  controls.enablePan = false; // 카메라 고정 후 수평 회전을 못하게 함. (카메라가 수평회전하면 지구본이 카메라 시야에서 벗어나버림)
  controls.minDistance = 1.2; // 카메라를 얼마나 가까운 거리까지 dolly in 할 수 있는지 결정함.
  controls.maxDistance = 4; // 카메라를 얼마나 멀리까지 dolly out 할 수 있는지 결정함.
  controls.update(); // 카메라 이동 관련 변화, enableDamping값을 지정해줬다면 반드시 업데이트 해줘야 함.

  // 씬을 생성하고 배경색을 파란색으로 지정함.
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#236');

  // 세계지도 윤곽선 텍스처를 로드해서 구체를 만들 때 텍스처로 입혀줌.
  {
    const loader = new THREE.TextureLoader();
    // 이 예제에서도 '불필요한 렌더링 삭제' 예제에서 했듯이 애니메이션이 필요 없으면 render 함수를 호출하지 않을 것임.
    // 근데 텍스처 로딩은 시간이 걸리는 작업이라 로딩이 완료되기 전에 render 함수가 최초 호출되면 텍스처가 입혀지지 않은 지구본이 그대로 화면이 출력될거임.
    // 그래서 .load 메서드의 onLoad 함수를 render로 넘겨줘서 텍스처 로드가 완료되면 render 함수를 한 번 더 호출시켜줌.
    const texture = loader.load('https://threejsfundamentals.org/threejs/resources/data/world/country-outlines-4k.png', render);
    const geometry = new THREE.SphereGeometry(1, 64, 32);
    const material = new THREE.MeshBasicMaterial({
      map: texture
    }); // 조명의 영향을 받지 않아도 되므로 베이직-머티리얼로 사용하면 됨.
    scene.add(new THREE.Mesh(geometry, material));
  }

  // 지구본의 각 지역에 관한 JSON 데이터가 담긴 HTTP Response를 fetch(url)로 비동기로 받아와서 json() 메서드를 이용해 실제 JSON 오브젝트로 변환해 리턴해주는 함수
  async function loadJSON(url) {
    const req = await fetch(url);
    return req.json();
  }

  // 비동기로 가져온 JSON 데이터(각 나라별 이름, 위도, 경도, min, max(각 나라별 영역의 bounding box의 사이즈를 구하기 위한 최소, 최대 위,경도 좌표값이라고 해야하나?))를 담아놓을 변수
  let countryInfos;
  // 각 나라별로 위, 경도만큼 헬퍼 객체들을 회전시켜서 각 나라별 이름표의 전역공간 좌표값을 구해놓고, 이름표 요소를 생성해놓는 함수
  // loadJSON 함수가 비동기로 처리되기 때문에, 이것을 내부에서 실행하는 loadCountryData 함수도 비동기로 실행해줘야 함. 
  async function loadCountryData() {
    countryInfos = await loadJSON('https://threejsfundamentals.org/threejs/resources/data/world/country-info.json'); // 일단 JSON 데이터를 리턴받음.

    // 이 각도값들은 각각 lonHelper, latHelper의 회전각도를 구할 때 사용됨.
    // 왜 이런 각도값들이 필요하냐면, 이 헬퍼객체들을 회전시킨 뒤 마지막 자식노드인 positionHelper의 전역공간 좌표값을 구해서 이름표 위치값을 계산해주는건데,
    // 각 헬퍼객체의 rotation값을 줄 때, lon, lat는 엄밀히 말하면 위, 경도 좌표값(?)에 가깝지 회전에 필요한 '각도값'은 아니잖아.
    // 그래서 이 lon, lat값을 회전에 필요한 '각도값'으로 변환하기 위해 필요한 값들이라고 생각하면 됨.
    const lonFudge = Math.PI * 1.5; // 270도
    const latFudge = Math.PI; // 180도

    // 헬퍼 Object3D 객체들을 만든 뒤, 위, 경도값만큼 회전해서 이름표들의 변화하는 전역 공간상의 위치값을 쉽게 계산하려는 것.
    // 참고로 lonHelper를 scene에 추가해주지 않는 이유는, 전역공간 좌표값만 얻어오면 되기 때문에 굳이 얘내들을 씬에 렌더해줄 필요는 없음.
    const lonHelper = new THREE.Object3D(); // 얘는 Y축으로 회전시켜서 경도를 맞춤.
    const latHelper = new THREE.Object3D(); // 얘는 X축으로 회전시켜서 위도를 맞춤.
    lonHelper.add(latHelper);
    const positionHelper = new THREE.Object3D();
    // 왜 1로 했을까? 지구본이 radius를 1로 했기 때문에!
    // 단순히 위, 경도 헬퍼 객체들을 회전시킨다고 해서 각 이름표들의 좌표값을 구할 수는 없음. 왜냐? 엄밀히 따지면 이 헬퍼 객체들의 좌표값은 (0, 0, 0)이니까!
    // 근데 여기서 positionHelper의 z좌표값을 구체의 반지름 만큼으로 이동시킨 뒤 positionHelper 객체의 전역공간 좌표값을 구하면 지구본의 가장 겉면의 좌표값을 구할 수 있는 것이지
    positionHelper.position.z = 1;
    latHelper.add(positionHelper);

    // 이름표 요소들을 생성해 자식노드로 추가해 줄 부모 요소를 가져옴
    const labelParentElem = document.querySelector('#labels');
    // for...of로 돌면서 각 나라별 이름표의 좌표값을 계산해 줌. 이때, JSON 데이터의 iterable(순회 가능한 객체)를 const countryInfo로 받아서 처리해 줌.
    for (const countryInfo of countryInfos) {
      const {
        lat,
        lon,
        min,
        max,
        name
      } = countryInfo;

      // JSON 데이터 안의 각 나라별 lon, lat 값을 이용하여 회전각을 구해 헬퍼 Object3D들을 회전시켜 줌
      // 근데 이 loadCountryData 함수는 한 번만 호출되는데, 그럼 회전도 한번만 하면 되는걸까? 그렇지! 왜냐하면 지구본이 회전하는 것이 아니라,
      // OrbitControls를 통해 카메라를 공전시켜주는 거니까! 여기서 회전을 시켜주는건 헬퍼 객체들을 회전시켜 줌으로써 각 이름표 요소의 전역공간 좌표값만 구하려고 그러는 거임.
      lonHelper.rotation.y = THREE.MathUtils.degToRad(lon) + lonFudge;
      latHelper.rotation.x = THREE.MathUtils.degToRad(lat) + latFudge;

      // Object3D.updateWorldMatrix(updateParents, updateChildren)는 해당 객체의 전역 transform(위치, 회전, 크기 변경 등)이 바뀌면 그거를 업데이트해줌. 
      // positionHelper는 위,경도 헬퍼들의 자식노드인데, z값을 1만큼 이동했으니, 위,경도 헬퍼들이 회전만 하더라도 전역위치값이 바뀐 상태가 되겠지
      // 이거를 업데이트해줘야 아래에서 전역 위치값을 구할 수 있고, 얘는 자식노드가 없으니 false, 부모노드는 위,경도 헬퍼니까 얘네들의 전역 transform도 업데이트 해줘야 됨.
      positionHelper.updateWorldMatrix(true, false);
      const position = new THREE.Vector3(); // positionHelper의 전역공간 좌표값을 복사해서 넣어줄 Vec3 생성해놓음
      // Object3D.getWorldPosition(Vector3)는 전달한 Vec3에 객체의 전역공간상의 좌표값을 구해서 복사해 줌.
      // 왜 전역공간 좌표값을 구할까? 아래의 updateLabels에서 사용하는 project 메서드가 이름표의 NDC좌표값을 구하려면 전역공간 좌표값이 필요하기 때문!
      positionHelper.getWorldPosition(position);
      countryInfo.position = position; // 나라별 JSON 데이터 객체 안에 position 속성값을 추가하여 위에서 구한 이름표의 전역공간 좌표값을 넣어놓음

      // 이름표가 너무 많아서 뭉쳐보이는 문제를 해결하려면, 땅덩어리 영역이 큰 나라의 이름표만 우선적으로 보여주도록 할거임.
      // loadJSON 함수에서 받아온 JSON 데이터에는 각 나라가 차지하는 영역의 bounding box라고 해야되나? 암튼 그 영역의 min, max값이 지정되어 있음.
      // 이를 이용해서 각 나라의 영역 크기를 계산하여 영역이 큰 나라부터 우선적으로 보여주도록 할거임.
      const width = max[0] - min[0]; // 아마 max[0], min[0]은 영역에서 각각 최대, 최소 x좌표값 같음.
      const height = max[1] - min[1]; // max[1], min[1]은 영역에서 각각 최대, 최소 y좌표값 같음.
      const area = width * height;
      countryInfo.area = area; // 계산해준 각 나라 영역 넓이값을 area 라는 속성값을 만들어 할당해놓음

      // 각 나라별 이름표 요소를 생성해서 이름표들의 부모요소에 추가해줌
      const elem = document.createElement('div');
      elem.textContent = name;
      labelParentElem.appendChild(elem);
      countryInfo.elem = elem; // elem 속성값도 추가해서 생성한 이름표 요소를 넣어놓음.
    }

    requestAnimateIfNotRequested(); // 전역공간 좌표값을 구하고, 이름표를 생성하고 나서 render 함수를 한 번 더 호출해 줌
  }

  loadCountryData();

  // loadCountryData에서 구한 각 이름표의 전역 좌표값을 정규화된 NDC좌표값으로 변환해놓을 Vec3 생성
  const tempV = new THREE.Vector3();

  // updateLabels 함수에서 스칼라곱에 필요한 정규화된 방향 벡터들을 구하기 위해 필요한 Vec3 및 Mat3 값들 생성
  const cameraToPoint = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();

  // 이름표 표시 여부를 결정하는 영역넓이를 결정하는 길이값(?)과 코사인 값을 객체로 묶어서 지정해놓음.
  const settings = {
    // minArea는 제곱하여 기준이 될 영역 넓이값을 구할 수 있도록 해주는 길이값.
    minArea: 20,
    // 정규화된 방향 벡터들을 스칼라곱 했을 때의 코사인 결과값을 비교해 주는 값. 이 값보다 코사인값이 큰 이름표 요소들은 화면에 보여주지 않도록 하려는 것
    maxVisibleDot: -0.2
  };

  // 위에서 두 값을 묶어주는 이유는 dat.GUI에서 입력값을 받아와서 각 기준값을 사용자가 조정할 수 있도록 하기 위함.
  const gui = new GUI({
    width: 300
  }); // dat.GUI 객체 생성
  gui.add(settings, 'minArea', 0, 50).onChange(requestAnimateIfNotRequested);
  gui.add(settings, 'maxVisibleDot', -1, 1, 0.01).onChange(requestAnimateIfNotRequested);
  // 각 기준값이 입력값을 받아 변하면, render 함수를 요청해서 updateLabels를 실행되게 함으로써, 변경된 기준값으로 각 이름표 요소들의 표시여부 및 위치값들을 다시 계산해서 보여주도록 함. 

  // 예제 1번처럼 각 이름표의 전역 좌표값을 정규화된 NDC 좌표값으로 변환해서 현재 캔버스 해상도에 맞는 좌표값으로 변환해주는 함수
  // 참고로 얘도 예제 1번처럼 render 함수에서 매번 호출해줄건데, 이 예제는 render 함수를 애니메이션이 있을때만 호출하니까 이 함수도 그럴때만 호출되겠지
  function updateLabels() {
    if (!countryInfos) {
      // render 함수 내에서 이 함수가 호출되었을 때, 아직 JSON 데이터를 로드해오지 못해서 countryInfos가 비어있다면,
      // if block으로 들어온 뒤 이 함수를 끝내버림.
      return;
    }

    // dat.GUI에서 받은 입력값을 제곱하여 기준이 될 영역넓이값 large를 구해놓음
    const large = settings.minArea * settings.minArea;

    // 카메라의 전역 행렬변환을 정규 행렬로 변환하여 normalMatrix에 저장함
    normalMatrix.getNormalMatrix(camera.matrixWorldInverse);
    // 카메라의 전역공간 위치값을 복사하여 cameraPosition에 복사함
    camera.getWorldPosition(cameraPosition);

    for (const countryInfo of countryInfos) {
      const {
        position,
        elem,
        area
      } = countryInfo; // 얘내는 loadCountryData에서 만들어서 각 countryInfo에 넣어놨던 속성값들을 다시 불러오는 것

      // 현재 반복 순회에서 처리되는 이름표 요소의 영역넓이값이 large보다 작다면 화면에 안보이게 함
      if (area < large) {
        elem.style.display = 'none';
        continue; // 여기서도 마찬가지로 이름표를 안보여줄거면 굳이 아래의 계산을 해줄 필요가 없으니 다음 반복 순회로 넘어가라고 하는 것.
      }

      // 구체의 중점에서 이름표 요소까지의 방향을 나타내는 단위벡터를 구하는 것 같은데 자세한 원리는 모르겠음...
      tempV.copy(position);
      tempV.applyMatrix3(normalMatrix);

      // 카메라로부터 이름표까지의 방향을 나타내는 단위벡터를 구하는 것 같은데 자세한 원리는 모르겠음...
      cameraToPoint.copy(position);
      cameraToPoint.applyMatrix4(camera.matrixWorldInverse).normalize();

      /**
       * 위에서 구한 두 단위벡터 사이의 각도값의 코사인이 dot에 할당될거임.
       * 
       * 이거는 '스칼라곱' 즉, 벡터의 내적에 있어서 기본적인 개념이라고 할 수 있음.
       * 예를 들어, 동일한 출발점에서 시작하는 VecA, VecB 가 있고, 두 벡터의 크기를 각각 A, B라고 하면,
       * VecA.dot(VecB) = A * B * 두 벡터 사이 각도의 cos값이 되는 것.
       * 
       * 이 때, 만약 A, B 모두 1인 단위벡터라면? 두 벡터의 스칼라곱 자체가 두 벡터 사이 각도의 cos값이나 마찬가지인 셈.
       * 따라서, 이 cos값이 어느 정도냐에 따라 두 벡터 사이 각도값을 알 수 있고, 
       * 이 각도에 따라 이름표가 카메라를 바라보는지, 구체의 가장자리에 있는지, 구체의 뒤에 있는지, 각 지점의 사이에 있는지를 알 수 있음.
       * 
       * 그래서 위에서 지정해 준 maxVisibleDot이 이름표 요소가 뒤로 넘어가기 시작하는 cos값 지점인 것이고, 이것보다 코사인값이 크면 이름표 요소를 안보이게 해주려는 것임.
       */
      const dot = tempV.dot(cameraToPoint); // 위에서 구한 두 단위벡터를 스칼라곱 해줘서 각도의 cos값을 얻어냄

      if (dot > settings.maxVisibleDot) {
        elem.style.display = 'none';
        continue; // for...of 반복문에서 사용된 continue 이므로, 현재까지의 반복 순회를 중단하고, 다음 반복 순회로 넘어가도록 함.
        // 왜냐면 어차피 이름표를 안보이게 할건데 굳이 아래에서 이름표의 캔버스 좌표값을 계산해줄 필요가 없잖아.
      }

      // 만약 dot이 maxVisibleDot보다 작아서 if block을 패스하고 왔다면, 이전에 해당 이름표가 숨겨졌을 수도 있으니 초기의 display값을 적용해준 것.
      elem.style.display = '';

      tempV.copy(position); // 각 이름표의 전역공간 좌표값을 tempV에 복사해줌
      /**
       * project(camera) 메서드는 1번 예제에서 사용했던 것과 마찬가지로
       * 1. 각 이름표의 전역공간 좌표값을 전달해 준 카메라를 기준으로 한 Camera Space의 좌표값으로 변환하고,
       * 2. 그 좌표값을 -1 ~ 1 사이의 좌표값으로 이루어진 큐브 공간 내의 정규화된 NDC 좌표값으로 변환해 줌.
       * 
       * 이 정규화된 좌표값은 왜 필요하다? 
       * 현재 캔버스의 해상도에 맞는 좌표값으로 변환해주기 위해서!
       */
      tempV.project(camera);

      // 이런 식으로 정규화된 좌표값을 캔버스 좌표계에 맞게 방향과 범위를 수정해준 뒤, 캔버스의 css 사이즈만 곱해주면 캔버스 상의 좌표값으로 만들어버릴 수 있음
      const x = (tempV.x * 0.5 + 0.5) * canvas.clientWidth;
      const y = (tempV.y * -0.5 + 0.5) * canvas.clientHeight;

      // 이름표 요소를 위에서 구한 캔버스 좌표값으로 옮겨줌.
      // translate(-50%, -50%)은 이름표 요소의 정가운데를 x, y 좌표값으로 맞추려고 쓴 것
      elem.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;

      // 각 이름표 요소들의 정규화된 z좌표값을 0 ~ 100000 사이의 정수값으로 변환해서 이름표 요소의 z-index로 할당함
      elem.style.zIndex = (-tempV.z * 0.5 + 0.5) * 100000 | 0;
    }
  }

  // resize renderer
  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }

    return needResize;
  }

  // render함수안의 OrbitControls.update()에 의해 render 함수를 호출하려는 건지,
  // 아니면 실제로 change 이벤트나 resize 이벤트, loadCountryData 함수에 의해 호출하려는 건지 구분해주는 변수
  let renderRequested = false;

  // render
  function render() {
    renderRequested = undefined; // renderRequested 변수를 초기화함.

    // 렌더러가 리사이즈되면 변경된 사이즈에 맞게 카메라 비율(aspect)도 업데이트 해줌
    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    // OrbitControls.update()는 enableDamping 값이 활성화되면 update loop 안에서 호출해줘야 함.
    controls.update();

    // 카메라가 움직이거나 해서 호출되면 매 프레임마다 카메라 위치가 변경될테니, 각 이름표의 Camera space 좌표값이 바뀔거고, 그에 따라 NDC 좌표값도 바뀔테니 그때마다 호출하여 각 이름표의 캔버스 위치값을 계산해 매번 할당해줘야 함.
    updateLabels();

    renderer.render(scene, camera);
  }
  render(); // 최초 페이지 로드 후 화면에 보여줄 이미지를 렌더해야 하니까 최초 호출을 한 번 해줌.

  function requestAnimateIfNotRequested() {
    // render 함수가 진행되고 있는 와중에 
    // change 이벤트나 resize 이벤트를 받았다면, render 함수의 requestAnimationFrame이 예약된 상태가 되겠지?
    // 그런데 갑자기 render 함수가 다시 진행되다가 controls.update()를 마주치게 되는 경우 중복으로 render 함수를 예약하게 될 수 있음.
    // 하지만 아까 이미 예약하면서 renderRequested를 true로 바꿔놓은 상태이므로, update 메서드에 의한 requestAnimateIfNotRequested 함수 호출에서는
    // if block 을 통과하지 못하게 하여 render 함수의 중복 예약을 방지함. 
    if (!renderRequested) {
      renderRequested = true;
      requestAnimationFrame(render);
    }
  }

  controls.addEventListener('change', requestAnimateIfNotRequested);
  window.addEventListener('resize', requestAnimateIfNotRequested);
}

main();