function preventSubmit(event) {
    event.preventDefault();
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0,
        v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


class Chatbox {
    constructor() {
        this.elements = {
            refreshButton: document.querySelector('.chatbox__top-container__header__right-container__js-refresh-button'),
            closeButton: document.querySelector('.chatbox__top-container__header__right-container__js-close-button'),
            messages: document.querySelector('.chatbox__top-container__js-messages'),
            inputField: document.querySelector('.chatbox__footer__input-div__js-input'),
            sendButton: document.querySelector('.chatbox__footer__input-div__js-send-button'),
        }

        this.messages = [];
        this.suggestedPrompts = [];
        this.isProcessing = false;
        this.isDragging = false;

        this.userId = this.getUserId();

        this.startChat();
        this.display();
    }

    getUserId() {
        let userId = sessionStorage.getItem('neurafy_chatbot_userId');
        if (!userId) {
            userId = generateUUID();
            sessionStorage.setItem('neurafy_chatbot_userId', userId);
        }
        return userId;
    }

    updateSendAndRefreshButtons() {
        if (this.isProcessing) {
            this.elements.refreshButton.style.cursor = 'default';
            this.elements.refreshButton.disabled = true;
            this.elements.sendButton.style.cursor = 'default';
            this.elements.sendButton.disabled = true;
        } else {
            this.elements.refreshButton.style.cursor = 'pointer';
            this.elements.refreshButton.disabled = false;
            if (this.elements.inputField.value.trim() == '') {
                this.elements.sendButton.style.cursor = 'default';
                this.elements.sendButton.disabled = true;
            } else {
                this.elements.sendButton.style.cursor = 'pointer';
                this.elements.sendButton.disabled = false;
            }
        }
    }

    startChat() {
        this.messages = [];
        this.updateChatText()

        let settings = window.location.pathname.split("/")[2];
        fetch($SCRIPT_ROOT + '/chatbot/'  + settings + '/start-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: this.userId,
            })
        }).then(resp => {
            if (!resp.ok) {
                throw new Error(`HTTP error! status: ${resp.status}`);
            }
            return resp.json();
        }).then(resp => {
            for (let msg of resp.messages) {
                this.messages.push(msg)
                this.updateChatText()
            }
            window.parent.postMessage({type: 'chatMessages', data: resp.messages}, '*');
            for (let prompt of resp.suggested_prompts) {
                this.suggestedPrompts.push(prompt)
                this.updatePromptDiv()
            }
        }).catch((error) => {
            console.error('Error:', error);
            this.messages.push({"name": "Error", "message": error})
            this.updateChatText()
        });
    }

    refreshChat() {
        this.messages = [];
        this.updateChatText()

        let settings = window.location.pathname.split("/")[2];
        fetch($SCRIPT_ROOT + '/chatbot/'  + settings + '/refresh-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: this.userId,
            })
        }).then(resp => {
            if (!resp.ok) {
                throw new Error(`HTTP error! status: ${resp.status}`);
            }
            return resp.json();
        }).then(resp => {
            for (let msg of resp.messages) {
                this.messages.push(msg)
                this.updateChatText()
            }
        }).catch((error) => {
            console.error('Error:', error);
            this.messages.push({"name": "Error", "message": error})
            this.updateChatText()
        });
    }

    display() {
        this.elements.sendButton.addEventListener('click', () => this.onSendButton())

        this.elements.closeButton.addEventListener('click', () => {
            window.parent.postMessage({type: 'closeIframe', data: undefined}, '*');
        })

        this.elements.refreshButton.addEventListener('click', () => this.refreshChat())

        this.elements.inputField.addEventListener("keyup", ({
            key
        }) => {
            if ((key === "Enter") && (!this.isProcessing) && (this.elements.inputField.value !== '')) {
                this.onSendButton()
            }
        })

        this.elements.inputField.addEventListener('input', () => this.updateSendAndRefreshButtons())
        this.updateSendAndRefreshButtons()

        const promptDiv = document.querySelector('.chatbox__footer__prompt-div');
        let isDown = false;
        let startX;
        let scrollLeft;
        let prevTime;
        let prevScrollLeft;
        let velocity = 0;
        const threshold = 5;
        const velocityHistory = []; // Array to hold previous velocities
        const historyLength = 5; // Length of the history to consider

        promptDiv.addEventListener('mousedown', (e) => {
            isDown = true;
            velocityHistory.length = 0;
            startX = e.pageX - promptDiv.offsetLeft;
            scrollLeft = promptDiv.scrollLeft;
            prevTime = new Date().getTime();
            prevScrollLeft = scrollLeft;
        });

        promptDiv.addEventListener('mouseup', () => {
            isDown = false;
            requestAnimationFrame(function decelerate() {
                if (Math.abs(velocity) > 0.01) {
                    promptDiv.scrollLeft += velocity * 16; // Scale by frame duration for 60fps
                    velocity *= 0.96; // Deceleration factor
                    requestAnimationFrame(decelerate);
                }
            });
            setTimeout(() => {
                this.isDragging = false;
            }, 0);
        });

        promptDiv.addEventListener('mouseleave', () => {
            isDown = false;
            requestAnimationFrame(function decelerate() {
                if (Math.abs(velocity) > 0.001) {
                    promptDiv.scrollLeft += velocity * 16; // Scale by frame duration for 60fps
                    velocity *= 0.96; // Deceleration factor
                    requestAnimationFrame(decelerate);
                }
            });
            setTimeout(() => {
                this.isDragging = false;
            }, 0);
        });

        promptDiv.addEventListener('mousemove', (e) => {
            if (!isDown) return;

            const x = e.pageX - promptDiv.offsetLeft;
            const walk = x - startX;

            if (Math.abs(walk) > threshold) {
                this.isDragging = true;
            }

            promptDiv.scrollLeft = scrollLeft - walk;

            const currentTime = new Date().getTime();
            const timeDiff = currentTime - prevTime;
            const scrollDiff = promptDiv.scrollLeft - prevScrollLeft;
            const currentVelocity = timeDiff ? scrollDiff / timeDiff : 0;

            velocityHistory.push(currentVelocity);
            if (velocityHistory.length > historyLength) velocityHistory.shift();
            velocity = velocityHistory.reduce((acc, v) => acc + v, 0) / velocityHistory.length;

            prevTime = currentTime;
            prevScrollLeft = promptDiv.scrollLeft;
        });
    }

    onSendButton(promptText) {
        this.isProcessing = true;
        this.updateSendAndRefreshButtons();

        if (promptText===undefined) {
            promptText = this.elements.inputField.value;
            if (promptText === "") {
                this.updateChatText();
                this.isProcessing = false;
                this.updateSendAndRefreshButtons();
                return;
            }
            this.elements.inputField.value = '';
        }

        let userMsg = {
            name: "User",
            message: promptText,
        };
        this.messages.push(userMsg);

        let typingIndicator = {
            name: "TypingIndicator",
            message: "",
        };

        this.messages.push(typingIndicator);
        this.updateChatText();

        let settings = window.location.pathname.split("/")[2];
        const url = `${$SCRIPT_ROOT}/chatbot/${settings}/predict`;
        const body = JSON.stringify({
            message: promptText,
            userId: this.userId,
        });

        fetch(url, {
            method: 'POST',
            body: body,
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then(resp => {
            if (!resp.ok) {
                throw new Error(`HTTP error! status: ${resp.status}`);
            }

            let reader = resp.body.getReader();
            let decoder = new TextDecoder('utf-8');
            let outputMessage = '';

            let processStream = ({ done, value }) => {
                if (done) {
                    this.updateChatText();
                    this.isProcessing = false;
                    this.updateSendAndRefreshButtons();
                    return;
                }

                let chunk = decoder.decode(value);
                chunk.split('\n').forEach(eventString => {
                    if (!eventString.startsWith('data:')) {
                        return;
                    }
                    let outputToken = JSON.parse(eventString.slice('data:'.length).trim()).answer;
                    outputMessage += outputToken;
                    this.messages.pop();
                    this.messages.push({
                        name: "AI",
                        message: outputMessage,
                    });
                    this.updateChatText();
                });

                return reader.read().then(processStream);
            };

            return reader.read().then(processStream);
        })
        .catch((error) => {
            console.error(`Error reading data: ${error}`);
            this.messages.pop();
            this.messages.push({
                name: "Error",
                message: error,
            });
            this.updateChatText();
            this.isProcessing = false;
            this.updateSendAndRefreshButtons();
        });

    }

    updatePromptDiv() {
        const promptDiv = document.querySelector('.chatbox__footer__prompt-div');
        promptDiv.innerHTML = '';

        this.suggestedPrompts.forEach(prompt => {
            const button = document.createElement('button');
            button.className = 'chatbox__footer__prompt-div__prompt';

            const promptTextNode = document.createTextNode(prompt);
            button.appendChild(promptTextNode);

            button.addEventListener('click', () => {
                if (!this.isProcessing && !this.isDragging) {
                    this.onSendButton(prompt);
                }
            });

            promptDiv.appendChild(button);
        });
    }

    updateChatText() {
        this.elements.messages.innerHTML = '';

        let md = markdownit({
            linkify: true,
            linkTarget: '_blank',
        });

        md.linkify.add('www.', {
            validate: function (text, pos, self) {
                let tail = text.slice(pos);
                if (!self.re.test(tail)) {
                    return 0;
                }
                return tail.match(self.re)[0].length;
            },
            normalize: function (match) {
                match.url = 'https://' + match.url;
            },
        });

        this.messages.slice().forEach((item, index) => {
            if (typeof item.message !== 'string') {
                return;
            }

            let p = document.createElement('p');

            if (item.name === "AI") {
                p.className = "chatbox__top-container__js-messages__js-message chatbox__top-container__js-messages__js-message--from-ai";
            } else if (item.name === "User") {
                p.className = "chatbox__top-container__js-messages__js-message chatbox__top-container__js-messages__js-message--from-visitor";
            } else if (item.name === "Error") {
                p.className = "chatbox__top-container__js-messages__js-message chatbox__top-container__js-messages__js-message--error";
                message = '(!) Server error: "' + item.message + '"';
            } else if (item.name === "TypingIndicator") {
                p.className = "chatbox__top-container__js-messages__js-message chatbox__top-container__js-messages__js-message--typing-indicator";
                p.innerHTML = '<span></span><span></span><span></span>';
                this.elements.messages.appendChild(p);
                return;
            }

            let messageLines = item.message.split('\n');
            let processedLines = messageLines.map(line => md.renderInline(line));
            let parsedMarkdown = processedLines.join('<br>');

            let div = document.createElement('div');
            div.innerHTML = parsedMarkdown;

            for (let i = 0; i < div.childNodes.length; i++) {
                let childNode = div.childNodes[i].cloneNode(true);

                if (childNode.nodeName.toLowerCase() === 'a') {
                    if (item.name == "AI") {
                        childNode.style.color = '#4286F4';
                    } else {
                        childNode.style.color = 'white';
                    }
                    childNode.target = '_blank';
                }

                p.appendChild(childNode);
            }

            this.elements.messages.appendChild(p);
        });

        if (this.elements.messages) {
            window.scrollTo({
                // 37 is from message padding bottom + message margin bottom + footer padding top
                top: document.documentElement.scrollHeight - document.documentElement.clientHeight - 37
            })
        }
    }
}


if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
        const chatBox = new Chatbox();
    });
} else {
    const chatBox = new Chatbox();
}


let body = document.querySelector("body");
body.style.setProperty("--visitor-message-color", $VISITOR_MESSAGE_COLOR);
body.style.setProperty("--suggested-prompts-text-color", $SUGGESTED_PROMPTS_TEXT_COLOR);
body.style.setProperty("--suggested-prompts-background-color", $SUGGESTED_PROMPTS_BACKGROUND_COLOR);
