let currentPdf = null;
let selectedPages = new Set();
let hoverSound = document.getElementById('hoverSound');
let canPlaySound = true;

document.getElementById('pdfFile').addEventListener('change', handleFileSelect);
document.getElementById('downloadSelected').addEventListener('click', downloadSelectedPages);
document.getElementById('selectAll').addEventListener('click', selectAllPages);
document.getElementById('deselectAll').addEventListener('click', deselectAllPages);

// Create floating particles
function createParticles() {
    const numberOfParticles = 20;
    
    for (let i = 0; i < numberOfParticles; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random starting position
        particle.style.left = Math.random() * 100 + 'vw';
        particle.style.top = Math.random() * 100 + 'vh';
        
        // Random animation duration
        particle.style.animationDuration = (6 + Math.random() * 4) + 's';
        
        // Random delay
        particle.style.animationDelay = Math.random() * 5 + 's';
        
        document.body.appendChild(particle);
        
        // Remove and recreate particle when animation ends
        particle.addEventListener('animationend', () => {
            particle.remove();
            createParticles();
        });
    }
}

// Initialize particles
createParticles();

// Add sound throttling function
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Function to play hover sound
const playHoverSound = throttle(() => {
    if (canPlaySound) {
        hoverSound.currentTime = 0;
        hoverSound.volume = 0.2; // Adjust volume as needed
        hoverSound.play().catch(err => console.log('Audio play failed:', err));
    }
}, 100); // Throttle to prevent sound spam

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
        showStatus('Please select a valid PDF file', 'error');
        return;
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        currentPdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        
        document.getElementById('totalPages').textContent = currentPdf.numPages;
        document.getElementById('pageInfo').classList.remove('hidden');
        
        // Clear previous selections
        selectedPages.clear();
        
        // Generate page previews
        await generatePagePreviews();
        
        // Show action buttons
        document.getElementById('actionButtons').classList.remove('hidden');
        
        showStatus('Click on pages to select them for download', 'success');
    } catch (error) {
        showStatus('Error loading PDF: ' + error.message, 'error');
    }
}

async function generatePagePreviews() {
    const pagesGrid = document.getElementById('pagesGrid');
    pagesGrid.innerHTML = '';
    pagesGrid.classList.remove('hidden');

    for (let i = 1; i <= currentPdf.numPages; i++) {
        const pageContainer = document.createElement('div');
        pageContainer.className = 'page-item';
        pageContainer.dataset.pageNumber = i;

        const pageNumber = document.createElement('div');
        pageNumber.className = 'page-number';
        pageNumber.textContent = `Page ${i}`;

        const canvas = document.createElement('canvas');
        const page = await currentPdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.5 });
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext('2d');
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        pageContainer.appendChild(canvas);
        pageContainer.appendChild(pageNumber);
        pagesGrid.appendChild(pageContainer);

        // Add click handler for selection
        pageContainer.addEventListener('click', () => togglePageSelection(i, pageContainer));

        // Add hover sound effect
        pageContainer.addEventListener('mouseenter', playHoverSound);
    }
}

function togglePageSelection(pageNumber, element) {
    if (selectedPages.has(pageNumber)) {
        selectedPages.delete(pageNumber);
        element.classList.remove('selected');
    } else {
        selectedPages.add(pageNumber);
        element.classList.add('selected');
    }
    updateStatus();
}

function selectAllPages() {
    const pageItems = document.querySelectorAll('.page-item');
    pageItems.forEach(item => {
        const pageNumber = parseInt(item.dataset.pageNumber);
        selectedPages.add(pageNumber);
        item.classList.add('selected');
    });
    updateStatus();
}

function deselectAllPages() {
    const pageItems = document.querySelectorAll('.page-item');
    pageItems.forEach(item => {
        item.classList.remove('selected');
    });
    selectedPages.clear();
    updateStatus();
}

async function downloadSelectedPages() {
    if (selectedPages.size === 0) {
        showStatus('Please select at least one page', 'error');
        return;
    }

    try {
        showStatus('Preparing selected pages for download...', 'success');
        
        // Sort pages in ascending order
        const sortedPages = Array.from(selectedPages).sort((a, b) => a - b);
        
        // Create a new PDF document
        const pdfDoc = await PDFLib.PDFDocument.create();
        
        // Get the ArrayBuffer of the source PDF
        const existingPdfBytes = await currentPdf.getData();
        
        // Load the source PDF with encryption handling
        const sourcePdf = await PDFLib.PDFDocument.load(existingPdfBytes, {
            ignoreEncryption: true
        });
        
        // Copy the selected pages
        for (const pageNum of sortedPages) {
            const [copiedPage] = await pdfDoc.copyPages(sourcePdf, [pageNum - 1]);
            pdfDoc.addPage(copiedPage);
        }
        
        // Save the new PDF
        const newPdfBytes = await pdfDoc.save();
        
        // Create a blob and download
        const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'selected_pages.pdf';
        a.click();
        URL.revokeObjectURL(url);

        showStatus(`Downloaded ${selectedPages.size} pages successfully`, 'success');
    } catch (error) {
        showStatus('Error creating PDF: ' + error.message, 'error');
        console.error(error);
    }
}

function updateStatus() {
    showStatus(`${selectedPages.size} pages selected`, 'success');
}

function showStatus(message, type) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = 'status ' + type;
} 