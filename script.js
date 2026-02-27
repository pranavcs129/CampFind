import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- Authentication Logic (Supabase) ---
    const CampFindAuth = {
        async login(email, password) {
            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password,
                });
                if (error) throw error;
                window.location.href = 'index.html';
            } catch (error) {
                console.error("Login failed:", error);
                alert("Login failed: " + error.message);
            }
        },

        async loginWithGoogle() {
            try {
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: window.location.origin + '/index.html'
                    }
                });
                if (error) throw error;
            } catch (error) {
                console.error("Google Login failed:", error);
                alert("Google Login failed: " + error.message);
            }
        },

        async signup(email, password, name) {
            try {
                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            displayName: name,
                        }
                    }
                });
                if (error) throw error;
                alert("Signup successful! Please check your email for verification.");
                window.location.href = 'login.html';
            } catch (error) {
                console.error("Signup failed:", error);
                alert("Signup failed: " + error.message);
            }
        },

        async logout() {
            try {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
                window.location.href = 'index.html';
            } catch (error) {
                console.error("Logout failed:", error);
            }
        }
    };

    // Check Auth State & Update UI
    supabase.auth.onAuthStateChange((event, session) => {
        const user = session?.user;

        if (user) {
            const authButtons = document.querySelectorAll('.nav-auth .btn-cosmic, .nav-auth .btn-glass, .nav-auth .btn-neon');

            const navAuthContainer = document.querySelector('.nav-auth');
            if (navAuthContainer) {
                navAuthContainer.innerHTML = `
                    <a href="dashboard.html" class="btn-cosmic">Dashboard</a>
                `;
            }

            // Redirect if on login/signup pages
            const path = window.location.pathname;
            if (path.includes('login.html') || path.includes('signup.html')) {
                window.location.replace('index.html');
            }

            // Dashboard Personalization
            if (path.includes('dashboard.html')) {
                const welcomeMsg = document.getElementById('welcome-msg');
                const settingsNameInput = document.getElementById('settings-name');
                const displayName = user.user_metadata.displayName || 'Student';

                if (welcomeMsg) welcomeMsg.innerText = `Welcome back, ${displayName}`;
                if (settingsNameInput) settingsNameInput.value = displayName || '';

                checkStrikes(user.id);
            }

        } else {
            // Not logged in
            const navAuthContainer = document.querySelector('.nav-auth');
            if (navAuthContainer && !navAuthContainer.querySelector('.btn-glass')) {
                navAuthContainer.innerHTML = `
                    <a href="login.html" class="btn-glass">Log In</a>
                    <a href="signup.html" class="btn-neon">Sign Up</a>
                 `;
            }
        }
    });

    // Logout Handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            CampFindAuth.logout();
        });
    }

    // Google Login Handler
    const googleBtns = document.querySelectorAll('.btn-google');
    googleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            CampFindAuth.loginWithGoogle();
        });
    });


    // --- Supabase Data Logic ---
    const CampFindData = {
        async getAllItems() {
            const { data, error } = await supabase
                .from('items')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching items:', error);
                return [];
            }
            return data;
        },

        async getItemById(id) {
            const { data, error } = await supabase
                .from('items')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error fetching item:', error);
                return null;
            }
            return data;
        },

        async addItem(item) {
            const { data, error } = await supabase
                .from('items')
                .insert([item])
                .select();

            if (error) throw error;
            return data[0].id;
        },

        async updateItemStatus(id, status) {
            const { error } = await supabase
                .from('items')
                .update({ status: status })
                .eq('id', id);

            if (error) throw error;
        },

        async addClaim(itemId, claimData) {
            const userResponse = await supabase.auth.getUser();
            const user = userResponse.data.user;
            const claimantName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown';

            const { error } = await supabase
                .from('claims')
                .insert([{
                    item_id: itemId,
                    item_title: claimData.item_title || 'Unknown Item',
                    claimant_name: claimantName,
                    claimant_email: user.email,
                    description: claimData.description,
                    status: 'pending',
                    user_id: user.id
                }]);

            if (error) throw error;
            await this.updateItemStatus(itemId, 'pending');
        },

        async getStats() {
            const { data: items, error } = await supabase
                .from('items')
                .select('status, type');

            if (error) {
                console.error("Error fetching stats:", error);
                return { totalReported: 0, claimed: 0, active: 0, lost: 0, found: 0 };
            }

            return {
                totalReported: items.length,
                claimed: items.filter(i => i.status === 'claimed' || i.status === 'resolved').length,
                active: items.filter(i => i.status === 'open').length,
                lost: items.filter(i => i.type === 'lost').length,
                found: items.filter(i => i.type === 'found').length
            };
        },

        async getReceivedClaims() {
            const userResponse = await supabase.auth.getUser();
            const user = userResponse.data?.user;
            if (!user) return [];

            const { data, error } = await supabase
                .from('claims')
                .select(`
                    *,
                    items!inner(user_id)
                `)
                .eq('items.user_id', user.id);

            if (error) {
                console.error("Error fetching received claims:", error);
                return [];
            }
            return data;
        },

        async getSentClaims() {
            const userResponse = await supabase.auth.getUser();
            const user = userResponse.data?.user;
            if (!user) return [];

            const { data, error } = await supabase
                .from('claims')
                .select('*')
                .eq('user_id', user.id);

            if (error) {
                console.error("Error fetching sent claims:", error);
                return [];
            }
            return data;
        },

        async respondToClaim(claimId, itemId, action) {
            // action: 'accepted' or 'rejected'
            const { error: claimError } = await supabase
                .from('claims')
                .update({ status: action })
                .eq('id', claimId);

            if (claimError) throw claimError;

            if (action === 'accepted') {
                const { error: itemError } = await supabase
                    .from('items')
                    .update({ status: 'resolved' })
                    .eq('id', itemId);
                if (itemError) throw itemError;
            } else if (action === 'rejected') {
                const { count } = await supabase
                    .from('claims')
                    .select('*', { count: 'exact', head: true })
                    .eq('item_id', itemId)
                    .eq('status', 'pending');

                if (count === 0) {
                    await supabase
                        .from('items')
                        .update({ status: 'open' })
                        .eq('id', itemId);
                }
            }
        },

        async getMessages(claimId) {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('claim_id', claimId)
                .order('created_at', { ascending: true });
            if (error) {
                console.error("Error fetching messages:", error);
                return [];
            }
            return data;
        },

        async sendMessage(claimId, messageText) {
            const userResponse = await supabase.auth.getUser();
            const user = userResponse.data?.user;
            if (!user) throw new Error("Not authenticated");

            const { error } = await supabase
                .from('messages')
                .insert([{
                    claim_id: claimId,
                    sender_id: user.id,
                    message: messageText
                }]);

            if (error) throw error;
        }
    };

    // Helper: Check Strikes
    async function checkStrikes(userId) {
        // Placeholder
        const strikeCount = 0;
        if (strikeCount >= 3) {
            const dashboardLayout = document.querySelector('.v5-dashboard-layout');
            if (dashboardLayout) {
                const banner = document.createElement('div');
                banner.className = 'strike-banner';
                banner.innerHTML = `<span class="material-icons-round">warning</span> Warning: You have ${strikeCount} rejected claims. Further misuse may result in a ban.`;
                const main = document.querySelector('main');
                main.insertBefore(banner, main.firstChild);
            }
        }
    }


    // Scroll Animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.fade-up, .slide-in-left');
    animatedElements.forEach(el => observer.observe(el));

    // Navbar Scroll Effect
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // --- Image Preview Logic ---
    function setupImagePreview() {
        const fileInput = document.getElementById('item-image');
        if (!fileInput) return;

        fileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            const container = fileInput.closest('.image-upload-container');
            const text = container.querySelector('p');
            const icon = container.querySelector('.material-icons-round');

            if (file) {
                text.innerText = file.name;
                text.style.color = 'var(--accent-primary)';

                const reader = new FileReader();
                reader.onload = function (e) {
                    let preview = container.querySelector('.image-preview');
                    if (!preview) {
                        preview = document.createElement('div');
                        preview.className = 'image-preview';
                        preview.style.marginTop = '1rem';
                        preview.style.borderRadius = '8px';
                        preview.style.overflow = 'hidden';
                        preview.style.height = '150px';
                        preview.style.width = '100%';
                        preview.style.position = 'relative';
                        container.appendChild(preview);
                    }
                    preview.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    icon.style.color = 'var(--accent-primary)';
                }
                reader.readAsDataURL(file);
            } else {
                text.innerText = 'Click to upload image';
                text.style.color = 'var(--text-secondary)';
                icon.style.color = 'var(--text-secondary)';
                const preview = container.querySelector('.image-preview');
                if (preview) preview.remove();
            }
        });
    }

    setupImagePreview();

    // --- Form Handling ---
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btn = form.querySelector('button[type="submit"]');
            if (!btn) return;

            const originalText = btn.innerText;
            btn.innerText = 'Processing...';
            btn.style.opacity = '0.7';
            btn.disabled = true;

            const action = form.getAttribute('action');
            const pagePath = window.location.pathname.toLowerCase();

            // Auth Forms
            if (form.classList.contains('auth-form')) {
                const email = form.querySelector('input[type="email"]').value;
                const password = form.querySelector('input[type="password"]').value;
                const nameInput = form.querySelector('input[placeholder="John Doe"]');
                const name = nameInput ? nameInput.value : '';
                const isSignup = !!nameInput;

                if (isSignup) {
                    await CampFindAuth.signup(email, password, name);
                } else {
                    await CampFindAuth.login(email, password);
                }

                btn.innerText = originalText;
                btn.style.opacity = '1';
                btn.disabled = false;
                return;
            }

            // Post Item Forms
            if (action === 'dashboard.html' && (pagePath.includes('post-lost') || pagePath.includes('post-found'))) {
                try {
                    const { data: { user } } = await supabase.auth.getUser();

                    if (!user) {
                        alert('Please log in to post an item.');
                        window.location.href = 'login.html';
                        return;
                    }

                    const isLost = pagePath.includes('post-lost');
                    const title = document.getElementById('item-name').value;
                    const category = document.getElementById('category').value;
                    const location = document.getElementById('location').value;
                    const date_found = document.getElementById('date').value;
                    const descInput = document.getElementById('description');
                    const description = descInput ? descInput.value : `Found at ${location}`;

                    // Image Upload Logic
                    const fileInput = form.querySelector('input[type="file"]');
                    let imageUrl = null;
                    if (fileInput && fileInput.files[0]) {
                        const file = fileInput.files[0];
                        btn.innerText = 'Uploading image...';

                        const fileName = Date.now() + '_' + file.name;
                        const { data, error } = await supabase.storage
                            .from('items') // Ensure this bucket exists
                            .upload(fileName, file);

                        if (error) {
                            console.error("Image upload failed", error);
                            alert('Image upload failed: ' + error.message + '. Continuing without image.');
                        } else {
                            const { data: { publicUrl } } = supabase.storage
                                .from('items')
                                .getPublicUrl(fileName);
                            imageUrl = publicUrl;
                        }
                    }

                    btn.innerText = 'Saving item...';

                    const icons = {
                        electronics: 'laptop',
                        accessories: 'watch',
                        clothing: 'checkroom',
                        documents: 'badge',
                        other: 'category'
                    };

                    const newItem = {
                        title: title,
                        description: description,
                        category: category,
                        location: location,
                        date_found: date_found,
                        image_url: imageUrl,
                        status: 'open',
                        // timestamp: Date.now(), // Use created_at from DB
                        user_id: user.id,
                        type: isLost ? 'lost' : 'found'
                    };

                    await CampFindData.addItem(newItem);
                    console.log('Item added successfully');

                    btn.innerText = 'Success!';
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 500);
                } catch (error) {
                    console.error('Error posting item:', error);
                    alert('Failed to post item: ' + error.message);
                    btn.innerText = originalText;
                    btn.style.opacity = '1';
                    btn.disabled = false;
                }
                return;
            }

            // Fallback
            setTimeout(() => {
                btn.innerText = originalText;
                btn.style.opacity = '1';
                btn.disabled = false;
                form.reset();
            }, 1000);

        });
    });


    // --- Functionality: Page Specific ---
    const pagePath = window.location.pathname;

    // 1. Browse Page
    if (pagePath.includes('browse.html')) {
        const grid = document.getElementById('browse-grid');
        const searchInput = document.getElementById('browse-search');

        if (grid) {
            const loadItems = async () => {
                grid.innerHTML = '<p style="color:white; text-align:center; width:100%;">Loading items...</p>';
                const items = await CampFindData.getAllItems();
                renderItems(items);
            };

            const renderItems = (items) => {
                grid.innerHTML = '';
                if (items.length === 0) {
                    grid.innerHTML = '<p style="color:var(--text-secondary); text-align:center; width:100%; grid-column: 1/-1;">No items found.</p>';
                    return;
                }

                items.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'v5-card item-anim';
                    card.style.animation = 'fadeIn 0.5s ease forwards';

                    const timeAgo = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 3600000);
                    const timeString = timeAgo < 24 ? `${timeAgo}h ago` : `${Math.floor(timeAgo / 24)}d ago`;

                    let statusBadgeClass = 'status-open';
                    if (item.status === 'pending') statusBadgeClass = 'status-pending';
                    if (item.status === 'approved') statusBadgeClass = 'status-approved';
                    if (item.status === 'rejected') statusBadgeClass = 'status-rejected';
                    if (item.status === 'resolved') statusBadgeClass = 'status-resolved';
                    if (item.status === 'claimed') statusBadgeClass = 'status-resolved';

                    card.innerHTML = `
                        <div style="position: relative;">
                            <div class="v5-item-img">
                                ${item.image_url ? `<img src="${item.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">` : `<span class="material-icons-round" style="font-size: 3rem; color: rgba(255,255,255,0.1);">${item.icon || 'help_outline'}</span>`}
                            </div>
                            <span class="status-tag-v4 tag-${item.type}">${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</span>
                            <span class="status-corner-badge ${statusBadgeClass}">${item.status.toUpperCase()}</span>
                        </div>
                        <h3 style="margin-bottom: 0.5rem;">${item.title}</h3>
                        <p style="color: rgba(255,255,255,0.6); font-size: 0.9rem; margin-bottom: 1rem;">${item.description}</p>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; font-size: 0.85rem; color: rgba(255,255,255,0.4);">
                            <span>${item.location}</span>
                            <span>${timeString}</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <a href="item-details.html?id=${item.id}" class="v5-btn-outline" style="flex: 1; text-align: center;">View</a>
                             ${item.status === 'open' ? getCompactActionBtn(item) : ''}
                        </div>
                    `;
                    grid.appendChild(card);
                });
            };

            const getCompactActionBtn = (item) => {
                if (item.type === 'lost') {
                    return `<button class="v5-btn-outline btn-flag" title="I Found This" onclick="window.location.href='item-details.html?id=${item.id}&action=claim'"><span class="material-icons-round" style="font-size:1rem;">handshake</span></button>`;
                } else {
                    return `<button class="v5-btn-outline btn-flag" title="This Is Mine" onclick="window.location.href='item-details.html?id=${item.id}&action=claim'"><span class="material-icons-round" style="font-size:1rem;">emoji_people</span></button>`;
                }
            }

            loadItems();

            if (searchInput) {
                searchInput.addEventListener('input', async (e) => {
                    const items = await CampFindData.getAllItems();
                    const term = e.target.value.toLowerCase();
                    const activeChip = document.querySelector('.v5-chip.active');
                    const cat = activeChip ? activeChip.innerText : 'All Items';

                    const filtered = items.filter(item => {
                        const matchesText = item.title.toLowerCase().includes(term) || item.location.toLowerCase().includes(term);
                        const matchesCategory = cat === 'All Items' || item.category === cat.toLowerCase(); // simplified comparison
                        return matchesText && matchesCategory;
                    });
                    renderItems(filtered);
                });
            }
        }
    }

    // 2. Item Details Page
    if (pagePath.includes('item-details.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const itemId = urlParams.get('id');
        const autoAction = urlParams.get('action');

        if (itemId) {
            CampFindData.getItemById(itemId).then(item => {
                if (!item) {
                    document.querySelector('.container').innerHTML = '<h2>Item not found</h2>';
                    return;
                }

                document.querySelector('h2').innerText = item.title;

                if (item.image) {
                    const imgContainer = document.querySelector('.glass-card div');
                    if (imgContainer) {
                        imgContainer.innerHTML = `<img src="${item.image}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;">`;
                        imgContainer.style.background = 'transparent';
                    }
                }

                const descP = document.querySelector('h3 ~ p');
                if (descP) descP.innerText = item.description;

                const badge = document.querySelector('.status-badge');
                if (badge) {
                    badge.innerText = item.type.toUpperCase();
                }

                const actionBtnsContainer = document.querySelector('.action-buttons');
                if (actionBtnsContainer) {
                    let mainBtnHtml = '';
                    if (item.type === 'found') {
                        mainBtnHtml = `<button id="claim-btn" class="btn btn-primary" style="width: 100%;">This is mine! (Claim)</button>`;
                    } else {
                        mainBtnHtml = `<button id="claim-btn" class="btn btn-primary" style="width: 100%;">I found this!</button>`;
                    }

                    const resolvedBtnHtml = `<button id="resolve-btn" class="btn btn-secondary" style="width: 100%;">Mark as Resolved</button>`;

                    actionBtnsContainer.innerHTML = `
                        ${mainBtnHtml}
                        ${resolvedBtnHtml}
                    `;

                    document.getElementById('claim-btn').addEventListener('click', () => {
                        openClaimModal(item);
                    });

                    document.getElementById('resolve-btn').addEventListener('click', async () => {
                        if (confirm("Mark this item as resolved?")) {
                            try {
                                await CampFindData.updateItemStatus(item.id, 'resolved');
                                alert("Item marked as resolved.");
                                window.location.reload();
                            } catch (error) {
                                console.error("Error marking item resolved:", error);
                                alert("Failed to mark item as resolved.");
                            }
                        }
                    });
                }

                if (autoAction === 'claim') {
                    openClaimModal(item);
                }

            });
        }
    }

    // 3. Dashboard Logic
    if (pagePath.includes('dashboard.html')) {
        CampFindData.getStats().then(stats => {
            const statReported = document.getElementById('stat-reported');
            const statClaimed = document.getElementById('stat-claimed');
            const statActive = document.getElementById('stat-active');
            if (statReported) statReported.innerText = stats.totalReported;
            if (statClaimed) statClaimed.innerText = stats.claimed;
            if (statActive) statActive.innerText = stats.active;
        });

        const loadDashboardItems = async () => {
            const userResponse = await supabase.auth.getUser();
            const currentUser = userResponse.data?.user;
            if (!currentUser) return;

            const items = await CampFindData.getAllItems();
            const myItems = items.filter(i => i.user_id === currentUser.id);

            const tableBody = document.getElementById('activity-table-body');
            if (tableBody) {
                tableBody.innerHTML = '';
                myItems.slice(0, 5).forEach(item => {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                    const timeAgo = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 3600000);
                    const timeString = timeAgo < 24 ? `${timeAgo}h ago` : `${Math.floor(timeAgo / 24)}d ago`;
                    const color = item.type === 'lost' ? '#ef4444' : '#10b981';
                    tr.innerHTML = `
                        <td style="padding: 1rem 0;"><span style="color: ${color}; font-size: 10px;">●</span> ${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</td>
                        <td style="font-weight: 500;">${item.title}</td>
                        <td style="color: rgba(255,255,255,0.5);">${item.location}</td>
                        <td style="text-align: right; color: rgba(255,255,255,0.5);">${timeString}</td>
                     `;
                    tableBody.appendChild(tr);
                });
            }

            const renderCard = (item) => {
                return `
                    <div class="v5-card">
                         <div style="position: relative;">
                             <span class="status-tag-v4 tag-${item.type}">${item.type.toUpperCase()}</span>
                             <span class="status-corner-badge status-${item.status}">${item.status.toUpperCase()}</span>
                         </div>
                         <h3 style="margin: 0.5rem 0;">${item.title}</h3>
                         <a href="item-details.html?id=${item.id}" class="v5-btn-outline" style="width: 100%; text-align: center;">View</a>
                    </div>
                 `;
            };

            const reportsGrid = document.getElementById('reports-grid');
            if (reportsGrid) reportsGrid.innerHTML = myItems.map(renderCard).join('');

            // Fetch and render Sent Claims (Claimed Items)
            const sentClaims = await CampFindData.getSentClaims();
            const claimedGrid = document.getElementById('claimed-grid');
            if (claimedGrid) {
                claimedGrid.innerHTML = '';
                if (sentClaims.length === 0) {
                    claimedGrid.innerHTML = '<p style="color: var(--text-secondary); width: 100%; grid-column: 1 / -1;">You haven\'t claimed any items yet.</p>';
                } else {
                    sentClaims.forEach(claim => {
                        const div = document.createElement('div');
                        div.className = 'v5-card';

                        let chatBtnHtml = '';
                        if (claim.status === 'accepted') {
                            chatBtnHtml = `<a href="chat.html?claim=${claim.id}" class="v5-btn" style="width: 100%; text-align: center; margin-top: 0.5rem; background: #10b981;">Open Chat</a>`;
                        }

                        div.innerHTML = `
                             <div style="position: relative;">
                                 <span class="status-corner-badge status-${claim.status}">${claim.status.toUpperCase()}</span>
                             </div>
                             <h3 style="margin: 0.5rem 0; margin-top: 1.5rem;">Regarding: ${claim.item_title}</h3>
                             <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">My Note: "${claim.description}"</p>
                             <a href="item-details.html?id=${claim.item_id}" class="v5-btn-outline" style="width: 100%; text-align: center;">View Item</a>
                             ${chatBtnHtml}
                        `;
                        claimedGrid.appendChild(div);
                    });
                }
            }

            // Fetch and render Received Claims
            const receivedClaims = await CampFindData.getReceivedClaims();
            const receivedList = document.getElementById('received-claims-list');
            if (receivedList) {
                receivedList.innerHTML = '';
                if (receivedClaims.length === 0) {
                    receivedList.innerHTML = '<p style="color: var(--text-secondary);">No claims received yet.</p>';
                } else {
                    receivedClaims.forEach(claim => {
                        const div = document.createElement('div');
                        div.className = 'glass-card';

                        let actionsHtml = '';
                        if (claim.status === 'pending') {
                            actionsHtml = `
                                <button class="v5-btn accept-claim-btn" style="background: var(--accent-primary);" data-id="${claim.id}" data-item="${claim.item_id}">Accept</button>
                                <button class="v5-btn-outline reject-claim-btn" data-id="${claim.id}" data-item="${claim.item_id}">Decline</button>
                            `;
                        } else if (claim.status === 'accepted') {
                            actionsHtml = `<a href="chat.html?claim=${claim.id}" class="v5-btn" style="background: #10b981;">Open Chat</a>`;
                        }

                        div.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem;">
                                <div style="flex: 1;">
                                    <h3 style="margin-bottom: 0.5rem;">Regarding: ${claim.item_title}</h3>
                                    <p style="color: var(--text-secondary); font-size: 0.9rem;">From: ${claim.claimant_name} (${claim.claimant_email})</p>
                                    <p style="margin-top: 1rem; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">"${claim.description}"</p>
                                </div>
                                <div style="text-align: right;">
                                    <span class="status-badge status-${claim.status}">${claim.status.toUpperCase()}</span>
                                    <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
                                        ${actionsHtml}
                                    </div>
                                </div>
                            </div>
                        `;
                        receivedList.appendChild(div);
                    });

                    document.querySelectorAll('.accept-claim-btn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            if (confirm('Accept this claim? Other pending claims will remain pending until rejected.')) {
                                try {
                                    await CampFindData.respondToClaim(e.target.dataset.id, e.target.dataset.item, 'accepted');
                                    window.location.reload();
                                } catch (error) {
                                    console.error("Error accepting claim:", error);
                                    alert("Failed to accept claim.");
                                }
                            }
                        });
                    });

                    document.querySelectorAll('.reject-claim-btn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            if (confirm('Decline this claim?')) {
                                try {
                                    await CampFindData.respondToClaim(e.target.dataset.id, e.target.dataset.item, 'rejected');
                                    window.location.reload();
                                } catch (error) {
                                    console.error("Error rejecting claim:", error);
                                    alert("Failed to reject claim.");
                                }
                            }
                        });
                    });
                }
            }
        };

        loadDashboardItems();
    }

    // --- Item Details Logic ---
    if (pagePath.includes('item-details.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const itemId = urlParams.get('id');
        if (itemId) {
            Promise.all([
                CampFindData.getItemById(itemId),
                supabase.auth.getUser()
            ]).then(([item, userResponse]) => {
                const currentUser = userResponse?.data?.user;
                const container = document.getElementById('item-details-container');

                if (!item) {
                    if (container) container.innerHTML = '<p style="text-align: center; width: 100%; grid-column: 1 / -1;">Item not found.</p>';
                    return;
                }

                if (container) {
                    const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Unknown';
                    const imageHtml = item.image_url
                        ? `<img src="${item.image_url}" alt="${item.title}" style="width: 100%; height: 100%; object-fit: cover;">`
                        : `<div style="text-align: center; color: var(--text-secondary);"><span class="material-icons-round" style="font-size: 5rem; opacity: 0.5;">image</span><p>No Image</p></div>`;

                    let actionButtonHtml = '';
                    if (currentUser && item.user_id === currentUser.id) {
                        actionButtonHtml = '<div class="notice-box"><span class="material-icons-round">info</span> You posted this item. View your dashboard to manage claims.</div>';
                    } else if (item.status === 'open' || item.type === 'lost') {
                        actionButtonHtml = '<button class="btn btn-primary" id="claim-btn" style="width: 100%;">This is mine! (Claim)</button>';
                    } else {
                        actionButtonHtml = `<div class="notice-box"><span class="material-icons-round">lock</span> This item is marked as ${item.status}.</div>`;
                    }

                    container.innerHTML = `
                        <div class="glass-card" style="padding: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; min-height: 400px; background: rgba(0,0,0,0.2);">
                            ${imageHtml}
                        </div>
                        <div class="glass-card">
                            <div class="status-badge status-${item.status || item.type}">${(item.status || item.type).toUpperCase()}</div>
                            <h2 style="margin-top: 1rem; margin-bottom: 0.5rem;">${item.title}</h2>
                            <p style="color: var(--accent-primary); font-weight: 500;">${item.category}</p>

                            <div style="margin: 2rem 0; height: 1px; background: var(--glass-border);"></div>

                            <div class="info-row">
                                <span class="material-icons-round info-icon">place</span>
                                <div>
                                    <h4 style="font-size: 0.9rem; color: var(--text-secondary);">Location</h4>
                                    <p>${item.location}</p>
                                </div>
                            </div>

                            <div class="info-row">
                                <span class="material-icons-round info-icon">event</span>
                                <div>
                                    <h4 style="font-size: 0.9rem; color: var(--text-secondary);">Date</h4>
                                    <p>${dateStr}</p>
                                </div>
                            </div>

                            <div style="margin: 2rem 0;">
                                <h3 style="font-size: 1.1rem;">Description</h3>
                                <p style="margin-top: 0.5rem;">${item.description || 'No description provided.'}</p>
                            </div>

                            <div class="action-buttons">
                                ${actionButtonHtml}
                            </div>
                        </div>
                    `;

                    const claimBtn = document.getElementById('claim-btn');
                    if (claimBtn) {
                        claimBtn.addEventListener('click', () => {
                            if (!currentUser) {
                                window.location.href = 'login.html';
                                return;
                            }
                            openClaimModal(item);
                        });
                    }
                }
            }).catch(error => {
                console.error("Error loading item details:", error);
                const container = document.getElementById('item-details-container');
                if (container) container.innerHTML = '<p style="text-align: center; width: 100%; grid-column: 1 / -1; color: var(--text-secondary);">Error loading item details.</p>';
            });
        }
    }

    // --- Modal Logic ---
    function openClaimModal(item) {
        let modal = document.getElementById('claim-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'claim-modal';
            modal.className = 'v5-modal-overlay';
            modal.innerHTML = `
                <div class="glass-card v5-modal-content fade-up visible">
                    <h3>Claim Item</h3>
                    <p style="margin-bottom: 1rem; color: var(--text-secondary);">Please provide details to verify ownership.</p>
                    <form id="claim-form">
                        <div class="form-group">
                            <label class="form-label">Description / Proof</label>
                            <textarea class="form-input" required placeholder="Describe unique markings, content, etc."></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Upload Proof (Optical)</label>
                            <input type="file" class="form-input">
                        </div>
                        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                            <button type="button" class="btn btn-secondary" id="cancel-claim">Cancel</button>
                            <button type="submit" class="btn btn-primary">Submit Claim</button>
                        </div>
                    </form>
                </div>
             `;
            document.body.appendChild(modal);

            const style = document.createElement('style');
            style.innerHTML = `
                .v5-modal-overlay {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
                    z-index: 9999; display: flex; align-items: center; justify-content: center;
                }
                .v5-modal-content {
                    width: 90%; max-width: 500px;
                }
             `;
            document.head.appendChild(style);

            document.getElementById('cancel-claim').addEventListener('click', () => modal.remove());
        }

        const form = modal.querySelector('form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const desc = form.querySelector('textarea').value;
            try {
                await CampFindData.addClaim(item.id, { description: desc, item_title: item.title });
                alert('Claim submitted for review!');
                modal.remove();
                window.location.reload();
            } catch (error) {
                console.error('Error submitting claim:', error);
                alert('Failed to submit claim. Please try again.');
            }
        };
    }

    // --- Restore Visual Animations ---
    const canvas = document.getElementById('hero-sequence');
    if (canvas) {
        const context = canvas.getContext('2d');
        const frameCount = 80;
        const currentFrame = { index: 0 };
        const images = [];
        const getFramePath = (index) => {
            const paddedIndex = index.toString().padStart(3, '0');
            return `assets/hero-sequence/Smooth_cinematic_transition_202602140058_d8df_${paddedIndex}.jpg`;
        };
        let imagesLoaded = 0;
        for (let i = 0; i < frameCount; i++) {
            const img = new Image();
            img.src = getFramePath(i);
            img.onload = () => {
                imagesLoaded++;
                if (i === 0) render();
            };
            images.push(img);
        }
        const render = () => {
            const img = images[currentFrame.index];
            if (img && img.complete) {
                const parent = canvas.parentElement;

                // Set canvas element dimensions to match parent
                const targetWidth = parent.clientWidth || window.innerWidth;
                const targetHeight = parent.clientHeight || window.innerHeight;

                if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;
                }

                context.clearRect(0, 0, canvas.width, canvas.height);

                // Calculate cover dimensions
                const imgRatio = img.width / img.height;
                const canvasRatio = canvas.width / canvas.height;

                let drawWidth = canvas.width;
                let drawHeight = canvas.height;
                let offsetX = 0;
                let offsetY = 0;

                if (canvasRatio > imgRatio) {
                    // Canvas is wider than image relative to height
                    drawHeight = canvas.width / imgRatio;
                    offsetY = (canvas.height - drawHeight) / 2;
                } else {
                    // Canvas is taller than image relative to width
                    drawWidth = canvas.height * imgRatio;
                    offsetX = (canvas.width - drawWidth) / 2;
                }

                context.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            }
        };

        // Re-render on resize to keep the canvas properly sized
        window.addEventListener('resize', render);

        const targetFPS = 24;
        const frameInterval = 1000 / targetFPS;
        let lastTime = 0;
        let forward = true;
        let pauseCounter = 0;
        const pauseFrames = 10;
        const animate = (timestamp) => {
            if (!lastTime) lastTime = timestamp;
            const deltaTime = timestamp - lastTime;
            if (deltaTime >= frameInterval) {
                lastTime = timestamp - (deltaTime % frameInterval);
                if (imagesLoaded === frameCount) {
                    if (pauseCounter > 0) {
                        pauseCounter--;
                    } else {
                        if (forward) {
                            currentFrame.index++;
                            if (currentFrame.index >= frameCount - 1) {
                                currentFrame.index = frameCount - 1;
                                forward = false;
                                pauseCounter = pauseFrames;
                            }
                        } else {
                            currentFrame.index--;
                            if (currentFrame.index <= 0) {
                                currentFrame.index = 0;
                                forward = true;
                                pauseCounter = pauseFrames;
                            }
                        }
                        render();
                    }
                }
            }
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }
    const bentoCards = document.querySelectorAll('.bento-card');
    bentoCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });

    // Accordion
    const accordionsV5 = document.querySelectorAll('.v5-accordion-header');
    accordionsV5.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            document.querySelectorAll('.v5-accordion-item').forEach(other => {
                if (other !== item) other.classList.remove('active');
            });
            item.classList.toggle('active');
        });
    });

    const footerCanvasEl = document.getElementById('footer-sequence');
    if (footerCanvasEl) {
        const footerCtx = footerCanvasEl.getContext('2d');
        const footerFrameCount = 70; // 000 to 070
        const footerImages = [];
        const footerSequence = { frame: 0 };
        let footerImagesLoaded = 0;

        // Resize Canvas
        const resizeFooterCanvas = () => {
            footerCanvasEl.width = window.innerWidth;
            footerCanvasEl.height = footerCanvasEl.parentElement.offsetHeight;
        };
        window.addEventListener('resize', resizeFooterCanvas);
        resizeFooterCanvas();

        // Load Images
        // Filename format: A_smoot_cenimatic_202602141157_m3m2w_XXX.jpg
        const footerBasePath = 'assets/footer-sequence/A_smoot_cenimatic_202602141157_m3m2w_';

        for (let i = 0; i <= footerFrameCount; i++) {
            const img = new Image();
            const indexStr = i.toString().padStart(3, '0');
            img.src = `${footerBasePath}${indexStr}.jpg`;
            img.onload = () => {
                footerImagesLoaded++;
                if (i === 0) renderFooterFrame(0); // Draw first frame immediately
            };
            footerImages.push(img);
        }

        const renderFooterFrame = (index) => {
            if (footerImages[index]) {
                // Draw cover style
                const img = footerImages[index];
                const canvasRatio = footerCanvasEl.width / footerCanvasEl.height;
                const imgRatio = img.width / img.height;

                let drawWidth, drawHeight, offsetX, offsetY;

                if (canvasRatio > imgRatio) {
                    drawWidth = footerCanvasEl.width;
                    drawHeight = footerCanvasEl.width / imgRatio;
                    offsetX = 0;
                    offsetY = (footerCanvasEl.height - drawHeight) / 2;
                } else {
                    drawWidth = footerCanvasEl.height * imgRatio;
                    drawHeight = footerCanvasEl.height;
                    offsetX = (footerCanvasEl.width - drawWidth) / 2;
                    offsetY = 0;
                }

                footerCtx.clearRect(0, 0, footerCanvasEl.width, footerCanvasEl.height);
                footerCtx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            }
        };

        // Animation Loop (Play Once)
        let footerReqId;
        let footerLastTime = 0;
        const footerFps = 24;
        const footerInterval = 1000 / footerFps;
        let footerHasPlayed = false;

        const animateFooter = (time) => {
            if (footerHasPlayed && footerSequence.frame >= footerFrameCount) {
                cancelAnimationFrame(footerReqId);
                return;
            }

            if (!footerLastTime) footerLastTime = time;
            const delta = time - footerLastTime;

            if (delta >= footerInterval) {
                footerLastTime = time - (delta % footerInterval);

                if (footerSequence.frame < footerFrameCount) {
                    footerSequence.frame++;
                    renderFooterFrame(footerSequence.frame);
                } else {
                    footerHasPlayed = true;
                    // Force render the specific last frame which we might swap for a high-res version later
                    renderFooterFrame(footerFrameCount);

                    // Optimization: Once finished, we can stop the loop entirely
                    cancelAnimationFrame(footerReqId);
                    return;
                }
            }
            footerReqId = requestAnimationFrame(animateFooter);
        };

        // Intersection Observer to run animation only when visible
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (!footerHasPlayed && !footerReqId) {
                        footerReqId = requestAnimationFrame(animateFooter);
                    }
                } else {
                    // Optional: Pause if scrolled away before finishing? 
                    // For "play once", usually we just let it run or pause.
                    // Let's pause to save resources, but resume if scrolled back.
                    if (footerReqId) {
                        cancelAnimationFrame(footerReqId);
                        footerReqId = null;
                        footerLastTime = 0; // Reset time delta so it doesn't jump
                    }
                }
            });
        }, { threshold: 0.1 });

        observer.observe(footerCanvasEl);
    }

    // --- Dashboard View Switching ---
    const navItems = document.querySelectorAll('.v5-nav-item[data-view]');
    const dashboardViews = document.querySelectorAll('.dashboard-view');

    if (navItems.length > 0 && dashboardViews.length > 0) {
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetView = item.getAttribute('data-view');

                // Remove active class from all nav items
                navItems.forEach(nav => nav.classList.remove('active'));

                // Add active class to clicked item
                item.classList.add('active');

                // Hide all views
                dashboardViews.forEach(view => {
                    view.style.display = 'none';
                });

                // Show target view
                const targetElement = document.getElementById(`view-${targetView}`);
                if (targetElement) {
                    targetElement.style.display = 'block';
                }
            });
        });
    }

    // --- Browse Page Search & Filter ---
    const browseSearch = document.getElementById('browse-search');
    const browseFilters = document.querySelectorAll('.v5-chip');
    const browseGrid = document.getElementById('browse-grid');

    if (browseSearch || browseFilters.length > 0) {
        let currentCategory = 'All Items';

        // Filter function
        const filterItems = () => {
            const searchTerm = browseSearch ? browseSearch.value.toLowerCase() : '';
            const cards = browseGrid ? browseGrid.querySelectorAll('.v5-card') : [];

            cards.forEach(card => {
                const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
                const category = card.getAttribute('data-category')?.toLowerCase() || '';
                const location = card.querySelector('p')?.textContent.toLowerCase() || '';

                const matchesSearch = title.includes(searchTerm) ||
                    category.includes(searchTerm) ||
                    location.includes(searchTerm);
                const matchesCategory = currentCategory === 'All Items' ||
                    category === currentCategory.toLowerCase();

                if (matchesSearch && matchesCategory) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        };

        // Search input listener
        if (browseSearch) {
            browseSearch.addEventListener('input', filterItems);
        }

        // Category        // Filter tags
        browseFilters.forEach(tag => {
            tag.addEventListener('click', () => {
                browseFilters.forEach(t => t.classList.remove('active'));
                tag.classList.add('active');
                currentCategory = tag.innerText;
                filterItems(); // Assuming filterBrowseItems is filterItems
            });
        });

        // Search input
        if (browseSearch) { // Added check for browseSearch
            browseSearch.addEventListener('input', filterItems); // Assuming filterBrowseItems is filterItems
        }

        // Initial load
        filterItems(); // Assuming filterBrowseItems is filterItems
    }

    // --- Chat Logic ---
    if (pagePath.includes('chat.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const claimId = urlParams.get('claim');

        if (!claimId) {
            document.getElementById('chat-title').innerText = "Invalid Chat";
        } else {
            let currentUser = null;
            let chatPollInterval = null;

            const loadChat = async () => {
                const userResponse = await supabase.auth.getUser();
                currentUser = userResponse.data?.user;
                if (!currentUser) {
                    window.location.href = 'login.html';
                    return;
                }

                // Fetch claim details to verify access and get title
                const { data: claimData, error: claimError } = await supabase
                    .from('claims')
                    .select('item_title, status')
                    .eq('id', claimId)
                    .single();

                if (claimError || !claimData) {
                    document.getElementById('chat-title').innerText = "Chat not found or access denied.";
                    return;
                }

                document.getElementById('chat-title').innerText = `Chat: ${claimData.item_title}`;

                // Load messages
                const fetchAndRenderMessages = async () => {
                    const messages = await CampFindData.getMessages(claimId);
                    const container = document.getElementById('chat-messages');
                    if (!container) return;

                    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;

                    container.innerHTML = messages.map(msg => {
                        const isMine = msg.sender_id === currentUser.id;
                        const cssClass = isMine ? 'message-mine' : 'message-theirs';
                        return `<div class="message-bubble ${cssClass}">${msg.message}</div>`;
                    }).join('');

                    if (isAtBottom) {
                        container.scrollTop = container.scrollHeight;
                    }
                };

                await fetchAndRenderMessages();
                const container = document.getElementById('chat-messages');
                if (container) container.scrollTop = container.scrollHeight; // Initial scroll to bottom

                // Poll every 3 seconds
                chatPollInterval = setInterval(fetchAndRenderMessages, 3000);
            };

            loadChat();

            const chatForm = document.getElementById('chat-form');
            if (chatForm) {
                chatForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const input = document.getElementById('chat-input');
                    const text = input.value.trim();
                    if (!text) return;

                    input.value = '';
                    try {
                        await CampFindData.sendMessage(claimId, text);
                        // Fetch immediately to show the new message faster
                        const fetchAndRenderMessages = async () => {
                            const messages = await CampFindData.getMessages(claimId);
                            const container = document.getElementById('chat-messages');
                            if (!container) return;
                            container.innerHTML = messages.map(msg => {
                                const isMine = msg.sender_id === currentUser.id;
                                const cssClass = isMine ? 'message-mine' : 'message-theirs';
                                return `<div class="message-bubble ${cssClass}">${msg.message}</div>`;
                            }).join('');
                            container.scrollTop = container.scrollHeight;
                        };
                        await fetchAndRenderMessages();
                    } catch (error) {
                        console.error('Error sending message:', error);
                        // alert('Failed to send message.'); // Silent error, just log it and fallback to next poll
                    }
                });
            }

            // Cleanup polling on unmount
            window.addEventListener('beforeunload', () => {
                if (chatPollInterval) clearInterval(chatPollInterval);
            });
        }
    }
});
