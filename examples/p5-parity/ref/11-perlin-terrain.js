function setup() {
  createCanvas(100, 100);

  describe('A hilly terrain drawn in gray against a black sky.');
}

function draw() {
  // Set the noise level and scale.
  let noiseLevel = 100;
  let noiseScale = 0.02;

  // Scale the input coordinate.
  let x = frameCount;
  let nx = noiseScale * x;

  // Compute the noise value.
  let y = noiseLevel * noise(nx);

  // Draw the line.
  line(x, 0, x, y);
}
