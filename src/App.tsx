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
    awaiting: "Đang chờ ảnh của bạn",
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
    errCamera: "Không thể truy cập camera.",
    errModelFail:
      "Không thể tải các mô hình nhận diện. Đảm bảo chúng ở trong thư mục public/models.",
    guessingText: "Đang đoán tuổi...", // Add Vietnamese translation here
  },
  en: {
    title: "How Old Do I Look?",
    subtitle:
      "Upload a photo or capture a selfie, and let our neural network analyze your features.",
    wakingUp: "Waking up the machine...",
    uploadBtn: "Upload Photo",
    openCamera: "Open Camera",
    closeCamera: "Close Camera",
    awaiting: "Awaiting your portrait",
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
    errCamera: "Unable to access camera.",
    errModelFail:
      "Failed to load detection models. Ensure they are in the public/models directory.",
    guessingText: "Guessing age...", // Add English translation here
  },
};

type Language = "vi" | "en";

const App: React.FC = () => {
  // Initialize from LocalStorage, default to "vi" if not found
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

  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const t = translations[lang];

  // Handler to update state AND local storage
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
      };
      reader.readAsDataURL(file);
      return false;
    },
    showUploadList: false,
  };

  const startCamera = async () => {
    setImageUrl(null);
    setDetectedAge(null);
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      message.error(t.errCamera);
      setIsCameraActive(false);
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

      // Run both the AI detection and a 2.5-second timer concurrently
      const [detection] = await Promise.all([
        faceapi
          .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions())
          .withAgeAndGender(),
        new Promise((resolve) => setTimeout(resolve, 2500)), // 2500ms artificial delay
      ]);

      if (detection) {
        setDetectedAge(Math.round(detection.age));
        setIsModalOpen(true);
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
              {/* Premium Language Switcher Pill */}
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
                  <Row justify="center" gutter={16}>
                    <Col>
                      <Upload {...uploadProps} accept="image/*">
                        <Button
                          size="large"
                          shape="round"
                          icon={<UploadOutlined />}
                        >
                          {t.uploadBtn}
                        </Button>
                      </Upload>
                    </Col>
                    <Col>
                      <Button
                        size="large"
                        shape="round"
                        type={isCameraActive ? "default" : "primary"}
                        ghost={!isCameraActive}
                        danger={isCameraActive}
                        icon={<CameraOutlined />}
                        onClick={isCameraActive ? stopCamera : startCamera}
                      >
                        {isCameraActive ? t.closeCamera : t.openCamera}
                      </Button>
                    </Col>
                  </Row>

                  {/* Wrap the preview-container with Spin to display loading text */}
                  <Spin spinning={analyzing} tip={t.guessingText} size="large">
                    <div className="preview-container">
                      {isCameraActive && (
                        <video
                          ref={videoRef}
                          autoPlay
                          muted
                          playsInline
                          className="media-element mirror-video" /* Added mirror-video here */
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
                        <div className="placeholder-text">
                          <ScanOutlined
                            style={{
                              fontSize: 48,
                              marginBottom: 12,
                              opacity: 0.5,
                              display: "block",
                            }}
                          />
                          {t.awaiting}
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

        {/* Modal for Results */}
        <Modal
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
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
              onClick={() => setIsModalOpen(false)}
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
