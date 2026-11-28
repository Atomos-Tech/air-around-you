import {
  type BufferGeometry,
  type Material,
  AmbientLight,
  CapsuleGeometry,
  CircleGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

export function mountAvatar(container: HTMLElement) {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(104, 132, false);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.append(renderer.domElement);

  const scene = new Scene();
  const camera = new OrthographicCamera(-0.91, 0.91, 1.15, -1.15, 0.1, 20);
  camera.position.set(2.65, 1.52, 4.4);
  camera.lookAt(0, 1.03, 0);
  scene.add(new AmbientLight(0xf3e5d6, 2));
  const sunlight = new DirectionalLight(0xffeee0, 2.9);
  sunlight.position.set(-3, 5, 3);
  scene.add(sunlight);
  const rimLight = new DirectionalLight(0x9ed1ff, 1.35);
  rimLight.position.set(3, 2, -3);
  scene.add(rimLight);

  const { character, torso, chest, head } = createCharacter();
  scene.add(character);

  const shadow = new Mesh(
    new CircleGeometry(0.37, 48),
    new MeshBasicMaterial({ color: 0x14241e, transparent: true, opacity: 0.37, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.003;
  shadow.scale.y = 0.72;
  scene.add(shadow);

  let frame = 0;
  let paused = true;
  let elapsed = 0;
  let lastFrame: number | null = null;
  function render(time: number) {
    if (lastFrame !== null) elapsed += Math.min(time - lastFrame, 55);
    lastFrame = time;
    const cycle = (elapsed % 6100) / 6100;
    const expansion =
      cycle < 0.38
        ? (1 - Math.cos((cycle / 0.38) * Math.PI)) / 2
        : (1 + Math.cos(((cycle - 0.38) / 0.62) * Math.PI)) / 2;
    chest.scale.set(1 + expansion * 0.17, 1 + expansion * 0.055, 1 + expansion * 0.24);
    torso.position.y = expansion * 0.035;
    head.rotation.y = Math.sin(elapsed / 3100) * 0.075;
    renderer.render(scene, camera);
    if (!paused) frame = requestAnimationFrame(render);
  }
  render(0);

  return {
    setPaused(next: boolean) {
      if (paused === next) return;
      paused = next;
      lastFrame = null;
      cancelAnimationFrame(frame);
      if (!paused) frame = requestAnimationFrame(render);
    },
    destroy() {
      cancelAnimationFrame(frame);
      const geometries = new Set<BufferGeometry>();
      const materials = new Set<Material>();
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          geometries.add(object.geometry);
          materials.add(object.material);
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

function createCharacter() {
  const character = new Group();
  const torso = new Group();
  const chest = new Group();
  const head = new Group();
  character.add(torso);
  torso.add(chest, head);

  chest.name = "chest";
  chest.position.y = 1.22;
  head.position.y = 1.71;

  function material(color: number) {
    return new MeshStandardMaterial({ color, roughness: 0.79 });
  }
  const skin = material(0xb57350);
  const hair = material(0x25201b);
  const coat = material(0xb66b3d);
  const trim = material(0x6c3d2c);
  const shirt = material(0xe5e6d9);
  const jeans = material(0x314f64);
  const shoe = material(0x262f32);
  const sole = material(0xd7d6c8);
  const eye = material(0x292120);

  const sphere = new SphereGeometry(1, 24, 16);
  function oval(
    parent: Group,
    paint: MeshStandardMaterial,
    position: [number, number, number],
    scale: [number, number, number],
  ) {
    const part = new Mesh(sphere, paint);
    part.position.fromArray(position);
    part.scale.fromArray(scale);
    parent.add(part);
  }

  function limb(
    parent: Group,
    paint: MeshStandardMaterial,
    start: [number, number, number],
    end: [number, number, number],
    radius: number,
  ) {
    const from = new Vector3().fromArray(start);
    const to = new Vector3().fromArray(end);
    const direction = to.clone().sub(from);
    const mesh = new Mesh(
      new CapsuleGeometry(radius, Math.max(0, direction.length() - 2 * radius), 5, 12),
      paint,
    );
    mesh.position.copy(from.addScaledVector(direction, 0.5));
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
    parent.add(mesh);
  }

  oval(chest, coat, [0, 0, 0], [0.225, 0.31, 0.128]);
  oval(chest, shirt, [0, 0.09, 0.12], [0.052, 0.22, 0.021]);
  oval(chest, trim, [0, 0.25, -0.028], [0.159, 0.09, 0.105]);
  oval(torso, trim, [0, 1.03, 0], [0.174, 0.082, 0.119]);
  limb(torso, skin, [0, 1.48, 0], [0, 1.68, 0], 0.074);
  oval(head, skin, [0, 0, 0], [0.145, 0.192, 0.133]);
  oval(head, skin, [0, -0.086, 0.046], [0.108, 0.091, 0.096]);
  const scalp = new Mesh(new SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.63), hair);
  scalp.position.set(0, 0.02, -0.012);
  scalp.scale.set(0.156, 0.185, 0.144);
  head.add(scalp);
  oval(head, skin, [0, -0.029, 0.132], [0.035, 0.045, 0.043]);
  oval(head, trim, [0, -0.095, 0.133], [0.04, 0.007, 0.006]);

  for (const side of [-1, 1]) {
    oval(head, skin, [side * 0.14, -0.021, 0], [0.027, 0.061, 0.029]);
    oval(head, eye, [side * 0.054, 0.019, 0.121], [0.017, 0.011, 0.01]);
    limb(torso, coat, [side * 0.17, 1.43, 0], [side * 0.283, 1.19, 0.008], 0.089);
    limb(torso, coat, [side * 0.274, 1.215, 0.006], [side * 0.287, 0.963, 0.029], 0.065);
    oval(torso, trim, [side * 0.285, 0.99, 0.025], [0.059, 0.043, 0.055]);
    oval(torso, skin, [side * 0.287, 0.92, 0.034], [0.045, 0.073, 0.044]);
    limb(character, jeans, [side * 0.091, 1.035, 0], [side * 0.105, 0.508, 0.018], 0.101);
    limb(character, jeans, [side * 0.105, 0.577, 0.016], [side * 0.115, 0.116, -0.022], 0.076);
    oval(character, sole, [side * 0.119, 0.039, 0.049], [0.081, 0.037, 0.148]);
    oval(character, shoe, [side * 0.119, 0.072, 0.044], [0.076, 0.057, 0.139]);
  }

  return { character, torso, chest, head };
}
