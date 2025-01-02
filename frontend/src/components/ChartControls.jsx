// src/components/ChartControls.jsx
import { HStack, IconButton } from '@chakra-ui/react';
import { RepeatIcon, DownloadIcon, ViewIcon } from '@chakra-ui/icons';
import PropTypes from 'prop-types';

const ChartControls = ({ 
  chartRef, 
  fullScreenRef, 
  title,
  onOpen,
  setActiveChart 
}) => {

  const handleDownload = () => {
    const ref = fullScreenRef?.current ? fullScreenRef : chartRef;
    if (!ref?.current) return;

    const link = document.createElement('a');
    const now = new Date();
    const localDateTime = now.toLocaleString('sv-SE', { timeZoneName: 'short' })
      .replace(' ', '_')
      .replace(':', '-');
    link.download = `${title}-${localDateTime}.png`;
    link.href = ref.current.toBase64Image();
    link.click();
  };

  const handleResetZoom = () => {
    // Reset both regular and fullscreen charts if they exist
    if (chartRef?.current?.resetZoom) {
      chartRef.current.resetZoom();
    }
    if (fullScreenRef?.current?.resetZoom) {
      fullScreenRef.current.resetZoom();  
    }
  };

  const handleFullscreen = () => {
    setActiveChart(title);
    onOpen();
  };

  return (
    <HStack 
      spacing={2} 
      position="absolute" 
      top={2} 
      right={2} 
      zIndex={10}
      pointerEvents="auto"
    >
      <IconButton
        size="sm"
        icon={<RepeatIcon />}
        onClick={handleResetZoom}
        aria-label="Reset zoom"
      />
      <IconButton
        size="sm"
        icon={<DownloadIcon />}
        onClick={handleDownload}
        aria-label="Download chart"
      />
      <IconButton
        size="sm"
        icon={<ViewIcon />}
        onClick={handleFullscreen}
        aria-label="Fullscreen"
      />
    </HStack>
  );
};

ChartControls.propTypes = {
  chartRef: PropTypes.shape({ current: PropTypes.object }),
  fullScreenRef: PropTypes.shape({ current: PropTypes.object }),
  title: PropTypes.string.isRequired,
  onDownload: PropTypes.func,
  onResetZoom: PropTypes.func,
  onOpen: PropTypes.func.isRequired,
  setActiveChart: PropTypes.func.isRequired
};

export default ChartControls;