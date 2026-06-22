// birefringence — source.js
// Handles the u_source bonus input: an uploaded image or webcam feed, read
// as a luminance thickness field and pushed through the birefringent medium.

export class Source {
  constructor(gl) {
    this.gl = gl;
    this.texture = gl.createTexture();
    this.video = null;
    this.active = false;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  async fromImage(file) {
    this.stopWebcam();
    const bitmap = await createImageBitmap(file);
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    gl.generateMipmap(gl.TEXTURE_2D);
    bitmap.close();
    this.active = true;
  }

  async fromWebcam() {
    this.stopWebcam();
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    this.video = document.createElement('video');
    this.video.srcObject = stream;
    this.video.muted = true;
    await this.video.play();
    this.active = true;
  }

  // Pulls the latest webcam frame into the texture; no-op for static images.
  update() {
    if (!this.video) return;
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
  }

  stopWebcam() {
    if (this.video) {
      this.video.srcObject.getTracks().forEach((t) => t.stop());
      this.video = null;
    }
  }

  clear() {
    this.stopWebcam();
    this.active = false;
  }
}
