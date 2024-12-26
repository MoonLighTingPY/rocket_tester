import { HStack, IconButton } from '@chakra-ui/react';
import { DownloadIcon, RepeatIcon, ViewIcon } from '@chakra-ui/icons';

const ChartControls = ({ chartRef, title, onOpen, setActiveChart }) => {
  const handleDownloadChart = (chartRef, title) => {
    const link = document.createElement('a');
    const now = new Date();
    const localDateTime = now.toLocaleString('sv-SE', { timeZoneName: 'short' })
      .replace(' ', '_')
      .replace(':', '-');
    link.download = `${title}-${localDateTime}.png`;
    link.href = chartRef.current.toBase64Image();
    link.click();
  };

  const handleResetZoom = (chartRef) => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  };

  return (
    <HStack 
      spacing={2} 
      position="absolute" 
      top={2} 
      right={2} 
      zIndex={10} // Increase z-index
      pointerEvents="auto" // Ensure clicks are captured
    >
      <IconButton
        size="sm"
        icon={<RepeatIcon />}
        onClick={() => handleResetZoom(chartRef)}
        aria-label="Reset zoom"
      />
      <IconButton
        size="sm"
        icon={<DownloadIcon />}
        onClick={() => handleDownloadChart(chartRef, title)}
        aria-label="Download chart"
      />
      <IconButton
        size="sm"
        icon={<ViewIcon />}
        onClick={() => {
          setActiveChart(title);
          onOpen();
        }}
        aria-label="Fullscreen"
      />
    </HStack>
  );
};

export default ChartControls;