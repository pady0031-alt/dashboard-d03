// Menú móvil responsive y accesible
document.addEventListener('DOMContentLoaded',function(){
  var toggle=document.querySelector('.nav-toggle');
  var links=document.querySelector('nav.links');
  if(toggle&&links){
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click',function(e){
      e.stopPropagation();
      var isOpen = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      toggle.textContent = isOpen ? '✕' : '☰';
      toggle.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
    });

    links.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click',function(){
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = '☰';
        toggle.setAttribute('aria-label', 'Abrir menú');
      });
    });

    document.addEventListener('click', function(e){
      if(links.classList.contains('open') && !links.contains(e.target) && !toggle.contains(e.target)){
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = '☰';
        toggle.setAttribute('aria-label', 'Abrir menú');
      }
    });

    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && links.classList.contains('open')){
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = '☰';
        toggle.setAttribute('aria-label', 'Abrir menú');
      }
    });
  }

  // Scroll reveal
  var reveals=document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    },{threshold:0.12});
    reveals.forEach(function(el){io.observe(el);});
  }else{
    reveals.forEach(function(el){el.classList.add('in');});
  }

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(function(item){
    var q=item.querySelector('.faq-q');
    if(q){
      q.addEventListener('click',function(){
        var wasOpen=item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach(function(i){i.classList.remove('open');});
        if(!wasOpen)item.classList.add('open');
      });
    }
  });

  // Contact form (demo — sin backend)
  var form=document.getElementById('contactForm');
  if(form){
    form.addEventListener('submit',function(e){
      e.preventDefault();
      form.style.display='none';
      document.getElementById('formSuccess').style.display='block';
    });
  }

  // ===================================================================
  // HERO COCKPIT INTERACTIVE SWITCHER
  // ===================================================================
  initHeroCockpit();

  // ===================================================================
  // ASISTENTE DE IA EN VIVO (Bottom-Right Chat)
  // ===================================================================
  initAiChat();
});

// ===================================================================
// HERO COCKPIT (Ventas, Operaciones, Clientes)
// ===================================================================
var heroCockpitData = {
  ventas: {
    status: 'TELEMETRÍA EN VIVO · 12ms',
    kpi1: { label: 'Facturación Mes', val: '2.847.654 €', trend: '▲ +15.3%', sub: 'vs objetivo', bars: [45, 60, 55, 78, 70, 90, 100] },
    kpi2: { label: 'Margen Bruto', val: '34.8%', trend: '▲ +2.4%', sub: 'rentabilidad', prog: 84 },
    kpi3: { label: 'Nivel de Servicio', val: '98.6%', trend: '● 48 tiendas', sub: 'activas', prog: 98 },
    aiInsight: '💡 <strong>Oportunidad detectada:</strong> Las ventas en el canal Retail superan la previsión un <strong>+15.3%</strong>. Se recomienda incrementar la reposición de stock en la delegación Norte antes del fin de semana.'
  },
  operaciones: {
    status: 'CADENA DE SUMINISTRO · Sincronizada',
    kpi1: { label: 'Rotación Stock', val: '14.2 días', trend: '▲ +8.1%', sub: 'ritmo óptimo', bars: [70, 65, 80, 85, 90, 88, 95] },
    kpi2: { label: 'Cumplimiento Envíos', val: '99.1%', trend: '● 0 retrasos', sub: 'hoy', prog: 99 },
    kpi3: { label: 'Rutas Activas', val: '128 rutas', trend: '▲ 100%', sub: 'eficiencia', prog: 94 },
    aiInsight: '⚡ <strong>Optimización logística:</strong> Las rutas Centro-Sur han reducido tiempos un <strong>18%</strong>. El stock de seguridad se mantiene al <strong>96%</strong> en todos los almacenes.'
  },
  clientes: {
    status: 'GESTOR DE CLIENTES · 2.409 activos',
    kpi1: { label: 'Clientes Activos', val: '2.409', trend: '▲ +13.1%', sub: 'este mes', bars: [50, 55, 65, 72, 80, 88, 92] },
    kpi2: { label: 'Tasa Retención', val: '89.2%', trend: '▲ +4.5%', sub: 'fidelidad', prog: 89 },
    kpi3: { label: 'Satisfacción NPS', val: '4.8 / 5.0', trend: '● Excelente', sub: 'calidad', prog: 96 },
    aiInsight: '🎯 <strong>Alerta de fidelización:</strong> El ticket medio en clientes recurrentes ha subido a <strong>34.50 €</strong>. 12 clientes estratégicos tienen alta propensión de compra este trimestre.'
  }
};

window.switchHeroCockpitTab = function(tabKey) {
  var data = heroCockpitData[tabKey];
  if (!data) return;

  var tabs = document.querySelectorAll('.cockpit-tab');
  tabs.forEach(function(btn) {
    btn.classList.remove('active');
  });
  var activeBtn = document.getElementById('tabCockpit' + tabKey.charAt(0).toUpperCase() + tabKey.slice(1));
  if (activeBtn) activeBtn.classList.add('active');

  var statusLabel = document.getElementById('cockpitStatusLabel');
  if (statusLabel) {
    var parts = data.status.split('·');
    statusLabel.innerHTML = '<strong>' + (parts[0] ? parts[0].trim() : data.status) + '</strong> · ' + (parts[1] ? parts[1].trim() : 'En vivo');
  }

  var l1 = document.getElementById('kpiHeroLabel1'), v1 = document.getElementById('kpiHeroVal1'), t1 = document.getElementById('kpiHeroTrend1');
  if (l1) l1.textContent = data.kpi1.label;
  if (v1) v1.textContent = data.kpi1.val;
  if (t1) t1.innerHTML = data.kpi1.trend + ' <span id="kpiHeroSub1">' + data.kpi1.sub + '</span>';

  var spark = document.getElementById('kpiHeroSpark1');
  if (spark && data.kpi1.bars) {
    spark.innerHTML = data.kpi1.bars.map(function(h, idx) {
      var isLast = idx === data.kpi1.bars.length - 1;
      return '<div class="spark-bar ' + (isLast ? 'active' : '') + '" style="height:' + h + '%;"></div>';
    }).join('');
  }

  var l2 = document.getElementById('kpiHeroLabel2'), v2 = document.getElementById('kpiHeroVal2'), t2 = document.getElementById('kpiHeroTrend2'), p2 = document.getElementById('kpiHeroProg2');
  if (l2) l2.textContent = data.kpi2.label;
  if (v2) v2.textContent = data.kpi2.val;
  if (t2) t2.innerHTML = data.kpi2.trend + ' <span id="kpiHeroSub2">' + data.kpi2.sub + '</span>';
  if (p2) p2.style.width = data.kpi2.prog + '%';

  var l3 = document.getElementById('kpiHeroLabel3'), v3 = document.getElementById('kpiHeroVal3'), t3 = document.getElementById('kpiHeroTrend3'), p3 = document.getElementById('kpiHeroProg3');
  if (l3) l3.textContent = data.kpi3.label;
  if (v3) v3.textContent = data.kpi3.val;
  if (t3) t3.innerHTML = data.kpi3.trend + ' <span id="kpiHeroSub3">' + data.kpi3.sub + '</span>';
  if (p3) p3.style.width = data.kpi3.prog + '%';

  var aiText = document.getElementById('aiHeroText');
  if (aiText) {
    aiText.innerHTML = '<p>' + data.aiInsight + '</p>';
  }
};

function initHeroCockpit() {
  var cockpit = document.getElementById('heroCockpit');
  if (!cockpit) return;

  var tabs = ['ventas', 'operaciones', 'clientes'];
  var currentIdx = 0;
  var userInteracted = false;

  cockpit.addEventListener('click', function() {
    userInteracted = true;
  });

  // Subtle auto-cycle if user is reading without clicking
  setInterval(function() {
    if (userInteracted) return;
    currentIdx = (currentIdx + 1) % tabs.length;
    window.switchHeroCockpitTab(tabs[currentIdx]);
  }, 7000);
}

function initAiChat() {
  if (document.querySelector('.ai-chat-container')) return;

  var chatContainer = document.createElement('div');
  chatContainer.className = 'ai-chat-container';
  chatContainer.innerHTML = `
    <div class="ai-chat-window" id="aiChatWindow">
      <div class="ai-chat-header">
        <div class="ai-chat-header-left">
          <div class="ai-chat-header-orb">IA</div>
          <div class="ai-chat-header-text">
            <h4>Centro de Mando IA</h4>
            <span>En línea · Asistente oficial</span>
          </div>
        </div>
        <div class="ai-chat-header-actions">
          <button class="ai-chat-btn-icon" id="aiChatResetBtn" title="Reiniciar conversación" aria-label="Reiniciar">↺</button>
          <button class="ai-chat-btn-icon" id="aiChatCloseBtn" title="Cerrar chat" aria-label="Cerrar">✕</button>
        </div>
      </div>

      <div class="ai-chat-chips" id="aiChatChips">
        <button class="ai-chat-chip" data-q="¿Cómo se conecta Excel y Power BI?">📊 Excel & Power BI</button>
        <button class="ai-chat-chip" data-q="¿Cuáles son los precios y qué incluye cada plan?">💳 Precios y Planes</button>
        <button class="ai-chat-chip" data-q="¿Qué módulos y KPIs puedo activar?">⚙️ Módulos y KPIs</button>
        <button class="ai-chat-chip" data-q="¿Cómo garantizáis la seguridad y el RGPD?">🔒 Seguridad y RGPD</button>
        <button class="ai-chat-chip" data-q="¿Cómo puedo solicitar una demo para mi empresa?">🚀 Solicitar Demo</button>
      </div>

      <div class="ai-chat-messages" id="aiChatMessages">
        <div class="ai-msg ai-msg-bot">
          <p>¡Hola! Soy el asistente inteligente de <strong>Centro de Mando IA</strong>.</p>
          <p>Puedo resolver cualquier duda sobre nuestros <strong>servicios</strong>, conexión con <strong>Excel y Power BI</strong>, <strong>módulos</strong>, <strong>planes</strong> o cómo <strong>solicitar una demo</strong> para tu negocio.</p>
          <div class="ai-msg-meta">Centro de Mando IA · Ahora</div>
        </div>
      </div>

      <div class="ai-typing-indicator" id="aiTypingIndicator">
        <div class="ai-typing-dot"></div>
        <div class="ai-typing-dot"></div>
        <div class="ai-typing-dot"></div>
        <span class="ai-typing-text">Asistente IA analizando respuesta...</span>
      </div>

      <div class="ai-chat-footer">
        <form class="ai-chat-input-form" id="aiChatForm">
          <input type="text" class="ai-chat-input" id="aiChatInput" placeholder="Pregunta sobre servicios, precios, integración..." autocomplete="off" required>
          <button type="submit" class="ai-chat-send-btn" id="aiChatSendBtn" title="Enviar consulta" aria-label="Enviar">➤</button>
        </form>
        <div class="ai-chat-footnote">IA en tiempo real · Conexión Excel, Power BI y ERPs</div>
      </div>
    </div>

    <button class="ai-chat-launcher" id="aiChatLauncher" aria-label="Abrir asistente de IA">
      <div class="ai-chat-launcher-orb">
        IA
        <div class="ai-chat-launcher-pulse"></div>
      </div>
      <div class="ai-chat-launcher-info">
        <div class="ai-chat-launcher-title">Asistente IA</div>
        <div class="ai-chat-launcher-status">Dudas &amp; Servicios</div>
      </div>
    </button>
  `;

  document.body.appendChild(chatContainer);

  var launcher = document.getElementById('aiChatLauncher');
  var windowEl = document.getElementById('aiChatWindow');
  var closeBtn = document.getElementById('aiChatCloseBtn');
  var resetBtn = document.getElementById('aiChatResetBtn');
  var formEl = document.getElementById('aiChatForm');
  var inputEl = document.getElementById('aiChatInput');
  var messagesEl = document.getElementById('aiChatMessages');
  var typingEl = document.getElementById('aiTypingIndicator');
  var chipsEl = document.getElementById('aiChatChips');

  var history = [];

  function formatMarkdown(text) {
    if (!text) return '';
    var escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Links [text](url)
    escaped = escaped.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

    // Bullet points
    var lines = escaped.split('\n');
    var inList = false;
    var output = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
        if (!inList) {
          output.push('<ul>');
          inList = true;
        }
        output.push('<li>' + line.substring(2) + '</li>');
      } else if (/^\d+\.\s/.test(line)) {
        if (!inList) {
          output.push('<ol>');
          inList = true;
        }
        output.push('<li>' + line.replace(/^\d+\.\s/, '') + '</li>');
      } else {
        if (inList) {
          output.push('</ul>');
          inList = false;
        }
        if (line.length > 0) {
          output.push('<p>' + line + '</p>');
        }
      }
    }
    if (inList) output.push('</ul>');
    return output.join('');
  }

  function toggleChat(forceOpen) {
    var isOpen = typeof forceOpen === 'boolean' ? forceOpen : !windowEl.classList.contains('open');
    if (isOpen) {
      windowEl.classList.add('open');
      launcher.style.display = 'none';
      setTimeout(function(){ inputEl.focus(); }, 150);
    } else {
      windowEl.classList.remove('open');
      launcher.style.display = 'flex';
    }
  }

  launcher.addEventListener('click', function(){ toggleChat(true); });
  closeBtn.addEventListener('click', function(){ toggleChat(false); });

  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && windowEl.classList.contains('open')) {
      toggleChat(false);
    }
  });

  resetBtn.addEventListener('click', function(){
    history = [];
    messagesEl.innerHTML = `
      <div class="ai-msg ai-msg-bot">
        <p>Conversación reiniciada. ¿En qué más puedo orientarte sobre <strong>Centro de Mando IA</strong>?</p>
        <div class="ai-msg-meta">Centro de Mando IA · Ahora</div>
      </div>
    `;
    inputEl.focus();
  });

  // Chips click handler
  if (chipsEl) {
    chipsEl.querySelectorAll('.ai-chat-chip').forEach(function(chip){
      chip.addEventListener('click', function(){
        var query = chip.getAttribute('data-q');
        if (query) {
          sendMessage(query);
        }
      });
    });
  }

  function appendMessage(sender, text) {
    var msgDiv = document.createElement('div');
    msgDiv.className = 'ai-msg ' + (sender === 'user' ? 'ai-msg-user' : 'ai-msg-bot');
    
    var timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    var senderLabel = sender === 'user' ? 'Tú' : 'Centro de Mando IA';

    if (sender === 'user') {
      msgDiv.innerHTML = `
        <p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        <div class="ai-msg-meta">${senderLabel} · ${timeStr}</div>
      `;
    } else {
      msgDiv.innerHTML = `
        ${formatMarkdown(text)}
        <div class="ai-msg-meta">${senderLabel} · ${timeStr}</div>
      `;
    }

    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessage(text) {
    var userText = text || inputEl.value.trim();
    if (!userText) return;

    inputEl.value = '';
    appendMessage('user', userText);
    history.push({ role: 'user', content: userText });

    typingEl.classList.add('active');
    messagesEl.scrollTop = messagesEl.scrollHeight;

    var sendBtn = document.getElementById('aiChatSendBtn');
    if (sendBtn) sendBtn.disabled = true;

    try {
      var res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, history: history })
      });

      var data = await res.json();
      typingEl.classList.remove('active');
      if (sendBtn) sendBtn.disabled = false;

      var reply = data.reply || 'Disculpa, no he podido procesar la respuesta en este momento. Por favor contáctanos en hola@centrodemando.ia.';
      appendMessage('bot', reply);
      history.push({ role: 'model', content: reply });
    } catch (err) {
      console.error('Error fetching chat response:', err);
      typingEl.classList.remove('active');
      if (sendBtn) sendBtn.disabled = false;
      appendMessage('bot', 'No ha sido posible conectar con el servidor. Puedes escribirnos a **hola@centrodemando.ia** o visitar nuestra sección de [Contacto](contacto.html).');
    }
  }

  formEl.addEventListener('submit', function(e){
    e.preventDefault();
    sendMessage();
  });
}
