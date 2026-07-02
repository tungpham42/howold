import React, { useState, useEffect, useRef } from "react";
import {
  Button,
  Card,
  Space,
  Typography,
  Upload,
  Spin,
  message,
  Row,
  Col,
  ConfigProvider,
  Modal,
} from "antd";
import {
  UploadOutlined,
  CameraOutlined,
  ScanOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import type { UploadProps } from "antd";
import * as faceapi from "face-api.js";
import "./App.css";

const { Title, Paragraph } = Typography;

// Multilingual Dictionary
const translations = {
  vi: {
    title: "Tôi trông bao nhiêu tuổi?",
    subtitle:
      "Tải ảnh lên hoặc chụp ảnh selfie và để máy phân tích các đặc điểm của bạn.",
    wakingUp: "Đang đánh thức máy...",
    uploadBtn: "Tải ảnh lên",
    openCamera: "Mở Camera",
    closeCamera: "Đóng Camera",
    clearBtn: "Xóa ảnh / Tắt Camera",
    awaiting: "Nhấn vào đây để tải ảnh hoặc mở camera",
    analyzeBtn: "Đoán tuổi",
    analyzingBtn: "Đang phân tích...",
    modalTitle: "Phân tích hoàn tất",
    modalResult: "Bạn trông",
    modalSuffix: "tuổi",
    awesomeBtn: "Tuyệt vời",
    errLoadModels: "Các mô hình vẫn đang tải...",
    errNoInput: "Vui lòng tải ảnh lên hoặc bật camera trước.",
    errNoFace:
      "Không phát hiện thấy khuôn mặt. Vui lòng đảm bảo bạn ở rõ trong khung hình.",
    errAnalyze: "Lỗi khi phân tích ảnh.",
    errCamera:
      "Không thể truy cập camera. Vui lòng cấp quyền hoặc thử lại trên trình duyệt mặc định.",
    errModelFail:
      "Không thể tải các mô hình nhận diện. Đảm bảo chúng ở trong thư mục public/models.",
    guessingText: "Đang đoán tuổi...",
  },
  en: {
    title: "How Old Do I Look?",
    subtitle:
      "Upload a photo or capture a selfie, and let our neural network analyze your features.",
    wakingUp: "Waking up the machine...",
    uploadBtn: "Upload Photo",
    openCamera: "Open Camera",
    closeCamera: "Close Camera",
    clearBtn: "Clear Media",
    awaiting: "Click here to upload or open camera",
    analyzeBtn: "Analyze Age",
    analyzingBtn: "Analyzing Features...",
    modalTitle: "Analysis Complete",
    modalResult: "You look",
    modalSuffix: "years old",
    awesomeBtn: "Awesome",
    errLoadModels: "Models are still loading...",
    errNoInput: "Please upload an image or start the camera first.",
    errNoFace: "No face detected. Please ensure you are clearly in the frame.",
    errAnalyze: "Error analyzing image.",
    errCamera:
      "Unable to access camera. Please grant permissions or try a default browser.",
    errModelFail:
      "Failed to load detection models. Ensure they are in the public/models directory.",
    guessingText: "Guessing age...",
  },
};

type Language = "vi" | "en";

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(() => {
    const savedLang = localStorage.getItem("preferredLang");
    return savedLang === "en" || savedLang === "vi" ? savedLang : "vi";
  });

  const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [detectedAge, setDetectedAge] = useState<number | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const [showOptions, setShowOptions] = useState<boolean>(false);
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const t = translations[lang];

  const handleLanguageToggle = (selectedLang: Language) => {
    setLang(selectedLang);
    localStorage.setItem("preferredLang", selectedLang);
  };

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = process.env.PUBLIC_URL + "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (error) {
        message.error(t.errModelFail);
        console.error(error);
      }
    };
    loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadProps: UploadProps = {
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageUrl(e.target?.result as string);
        setDetectedAge(null);
        stopCamera();
        setShowOptions(false);
        setHasAnalyzed(false);
      };
      reader.readAsDataURL(file);
      return false;
    },
    showUploadList: false,
  };

  const startCamera = async () => {
    // Kiểm tra xem trình duyệt có hỗ trợ mediaDevices không (thường bị chặn trên in-app browser)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      message.error(t.errCamera);
      return;
    }

    setImageUrl(null);
    setDetectedAge(null);
    setIsCameraActive(true);

    try {
      // Tối ưu hóa Constraints cho Mobile: Gọi camera trước và giới hạn độ phân giải
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowOptions(false);
      setHasAnalyzed(false);
    } catch (err) {
      message.error(t.errCamera);
      setIsCameraActive(false);
      console.error("Camera Error:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const clearMedia = () => {
    setImageUrl(null);
    stopCamera();
    setHasAnalyzed(false);
    setShowOptions(false);
  };

  const detectAge = async () => {
    if (!modelsLoaded) {
      message.warning(t.errLoadModels);
      return;
    }

    setAnalyzing(true);
    setDetectedAge(null);

    try {
      let input: HTMLImageElement | HTMLVideoElement | null = null;

      if (isCameraActive && videoRef.current) {
        input = videoRef.current;
      } else if (imageUrl && imageRef.current) {
        input = imageRef.current;
      }

      if (!input) {
        message.warning(t.errNoInput);
        setAnalyzing(false);
        return;
      }

      const [detection] = await Promise.all([
        faceapi
          .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions())
          .withAgeAndGender(),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);

      if (detection) {
        setDetectedAge(Math.round(detection.age));
        setIsModalOpen(true);
        setHasAnalyzed(true);
      } else {
        message.warning(t.errNoFace);
      }
    } catch (error) {
      message.error(t.errAnalyze);
      console.error(error);
    } finally {
      setAnalyzing(false);
    }
  };

  const closeResultModal = () => {
    setIsModalOpen(false);
    setImageUrl(null);
    stopCamera();
    setHasAnalyzed(false);
    setShowOptions(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <ConfigProvider
      theme={{
        token: {
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          colorPrimary: "#9333ea",
          borderRadius: 12,
          colorTextBase: "#1f2937",
        },
        components: {
          Button: {
            controlHeightLG: 48,
            fontSizeLG: 16,
            fontWeight: 600,
          },
        },
      }}
    >
      <div className="app-container">
        <Row justify="center" style={{ width: "100%" }}>
          <Col xs={24} sm={22} md={18} lg={14} xl={10}>
            <Card className="glass-card" bordered={false}>
              <div className="fancy-switcher-wrapper">
                <div className={`lang-pill ${lang}`}>
                  <div className="slider-bg" />
                  <button
                    className={`lang-btn ${lang === "vi" ? "active" : ""}`}
                    onClick={() => handleLanguageToggle("vi")}
                  >
                    <img
                      src="https://flagcdn.com/w40/vn.png"
                      alt="Vietnam Flag"
                      className="flag-icon"
                    />
                    <span className="lang-text">VN</span>
                  </button>
                  <button
                    className={`lang-btn ${lang === "en" ? "active" : ""}`}
                    onClick={() => handleLanguageToggle("en")}
                  >
                    <img
                      src="https://flagcdn.com/w40/gb.png"
                      alt="UK Flag"
                      className="flag-icon"
                    />
                    <span className="lang-text">EN</span>
                  </button>
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <Title level={2} className="title-text">
                  {t.title}
                </Title>
                <Paragraph className="subtitle-text">{t.subtitle}</Paragraph>
              </div>

              {!modelsLoaded ? (
                <div className="loading-container">
                  <Spin
                    indicator={
                      <LoadingOutlined
                        style={{ fontSize: 48, color: "#9333ea" }}
                        spin
                      />
                    }
                  />
                  <Title level={5} style={{ marginTop: 24, color: "#6b7280" }}>
                    {t.wakingUp}
                  </Title>
                </div>
              ) : (
                <Space
                  direction="vertical"
                  size="large"
                  style={{ width: "100%" }}
                >
                  <Spin spinning={analyzing} tip={t.guessingText} size="large">
                    <div
                      className="preview-container"
                      onClick={() => {
                        const canClick =
                          !showOptions &&
                          (hasAnalyzed || (!imageUrl && !isCameraActive));
                        if (canClick) {
                          setShowOptions(true);
                        }
                      }}
                      style={{
                        cursor:
                          !showOptions &&
                          (hasAnalyzed || (!imageUrl && !isCameraActive))
                            ? "pointer"
                            : "default",
                      }}
                    >
                      {/* Video tag optimized for Mobile/iOS */}
                      {isCameraActive && (
                        <video
                          ref={videoRef}
                          autoPlay
                          muted
                          playsInline
                          controls={false}
                          className="media-element mirror-video"
                        />
                      )}
                      {imageUrl && !isCameraActive && (
                        <img
                          ref={imageRef}
                          src={imageUrl}
                          alt="Target for analysis"
                          className="media-element"
                        />
                      )}

                      {!imageUrl && !isCameraActive && (
                        <Space wrap style={{ justifyContent: "center" }}>
                          <Upload
                            {...uploadProps}
                            accept="image/*"
                            showUploadList={false}
                          >
                            <Button
                              size="large"
                              shape="round"
                              type="primary"
                              icon={<UploadOutlined />}
                            >
                              {t.uploadBtn}
                            </Button>
                          </Upload>
                          <Button
                            size="large"
                            shape="round"
                            type="primary"
                            ghost
                            icon={<CameraOutlined />}
                            onClick={startCamera}
                          >
                            {t.openCamera}
                          </Button>
                        </Space>
                      )}

                      {showOptions && (imageUrl || isCameraActive) && (
                        <div className="options-overlay">
                          <Space
                            direction="vertical"
                            align="center"
                            size="middle"
                          >
                            <Space wrap style={{ justifyContent: "center" }}>
                              <Upload
                                {...uploadProps}
                                accept="image/*"
                                showUploadList={false}
                              >
                                <Button
                                  size="large"
                                  shape="round"
                                  icon={<UploadOutlined />}
                                >
                                  {t.uploadBtn}
                                </Button>
                              </Upload>
                              <Button
                                size="large"
                                shape="round"
                                type={isCameraActive ? "default" : "primary"}
                                ghost={!isCameraActive}
                                danger={isCameraActive}
                                icon={<CameraOutlined />}
                                onClick={
                                  isCameraActive ? stopCamera : startCamera
                                }
                              >
                                {isCameraActive ? t.closeCamera : t.openCamera}
                              </Button>
                            </Space>
                            <Button danger shape="round" onClick={clearMedia}>
                              {t.clearBtn}
                            </Button>
                          </Space>
                        </div>
                      )}
                    </div>
                  </Spin>

                  <Row justify="center">
                    <Button
                      type="primary"
                      size="large"
                      shape="round"
                      icon={<ScanOutlined />}
                      onClick={detectAge}
                      loading={analyzing}
                      disabled={!imageUrl && !isCameraActive}
                      style={{
                        width: "100%",
                        maxWidth: 320,
                        height: 56,
                        fontSize: 18,
                      }}
                    >
                      {analyzing ? t.analyzingBtn : t.analyzeBtn}
                    </Button>
                  </Row>
                </Space>
              )}
            </Card>
          </Col>
        </Row>

        <Modal
          open={isModalOpen}
          onCancel={closeResultModal}
          footer={null}
          centered
          className="transparent-modal"
          closeIcon={false}
          width={400}
        >
          <div className="result-box">
            <Title
              level={4}
              style={{ color: "rgba(255,255,255,0.8)", margin: 0 }}
            >
              {t.modalTitle}
            </Title>
            <Title level={2} className="result-text" style={{ marginTop: 8 }}>
              {t.modalResult} {detectedAge} {t.modalSuffix}
            </Title>
            <Button
              shape="round"
              onClick={closeResultModal}
              style={{ marginTop: 24, fontWeight: "bold" }}
            >
              {t.awesomeBtn}
            </Button>
          </div>
        </Modal>
      </div>
    </ConfigProvider>
  );
};

export default App;
