/* ==========================================================================
 * battle-ship-game.js v1.0
 * ==========================================================================
 *
 * Copyright 2015 Empire Templates
 * Developer: Baranov Oleg
 * Site: http://themeforest.net/user/EmpireTemplates
 * DRIBBBLE: https://dribbble.com/EmpireTemplates
 * BEHANCE: https://www.behance.net/Empire-Templates
 *
 * Description:
 * Классическая игра в морской бой.
 * 
 * ========================================================================== */
(function($){
	$(document).ready(function(e) {
		var inputErrorTimeout,  //счетчик времени
			player_name = '',   //имя игрока
			player_name_input = $('#player-name-input'), //поле для ввода имени игрока

			loading_indicator = $('.loading'),  //индикатор загрузки страницы
			game_status = $('#game-status'),    //статус игры ('Сейчас ваш ход', 'Сейчас ходит компьютер...')

			player_field = $('#player-field'),    //поле игрока
			computer_field = $('#computer-field'), //поле компьютера
			
			player_array = [],    //массив содержащий информацию о расстановке кораблей игрока
			computer_array = [],  //массив содержащий информацию о расстановке кораблей компьютера

			player_td,   //все элементы td на поле игрока
			computer_td, //все элементы td на поле компьютера
			
			move_count = 0,  //количество перемещений корабля при расстановке, необходимо для выхода из тупиковых ситуаций
			field_size = 10, //размер поля
			flag_block_player = false,  //состояние блокировки игрока во время хода компьютера
			max_points = 0,
			player_points,
			computer_points,
			score_game = [0, 0];

		//Переменные для составления тактики игры компьютера
		var computer_variants = [],        //все варианты компьютера для атаки в виде массива 10x10
			computer_variants_coords = [], //все варианты для атаки содержащий координаты ячеек. При попадании, из массива удаляется элемент
			computer_hit_variants = [],    //возможные варианты для атаки
			computer_td_direction = -1,    //определение ориентации корабля (-1 - неизвестно, 0 - по горизонтали, 1 - по вертикали)
			last_coords = [];              //координаты последнего удачного выстрела


		/* ------- ЗАПУСК ИГРЫ ------- */
		/* Привязываем функцию запуска игры к событиям */
		$('#start-game-form').on('submit', startGame);
		$('.start-game-btn').on('click', startGame);

		$('.new-game-btn').on('click', function(){
			resetScore();
			startGame();
		});


		/* Привязываем функцию завершения игры к событию нажатия на кнопку с классом .exit-game-btn */
		$('.exit-game-btn').on('click', exitGame);


		/* функция проверки работоспособности CSS параметра в браузере */
		function propIsSupported(prop) {
			return (prop in document.body.style);
		}


		/* Функция запуска игры */
		function startGame(){
			/* ----- Валидация введеного имени пользователя ----- */
			var input_info = $('#player-name-input-info');
			//Получаем имя пользователя из input и срузу удаляем лишние пробелы
			player_name = $.trim(player_name_input.val());	
			//Разрешенные символы представим в виде регулярного выражения
			var symbols = /^[A-Za-zА-Яа-я0-9 .]{0,}$/;

			//Если введенное имя пользователя содержит недопустимые символы или поле пустое,
			//то выводим ошибку и выходим из функции
			if(player_name.length == 0 || symbols.test(player_name) == false){
				showInputError(player_name_input, input_info);
				return false;
			}

			//Сброс значений переменных
			flag_block_player = false;
			computer_variants = [];
			computer_variants_coords = [];
			computer_hit_variants = [];
			computer_td_direction = -1;
			last_coords = [];
			move_count = 0;

			player_points = 0;
			computer_points = 0;

			input_info.removeClass('show');
			$('#score-player-name').html(player_name);

			//Генерация таблиц игрока и компьютера
			player_array = generateTable(player_field, player_array);
			computer_array = generateTable(computer_field, computer_array);

			//Показать корабли в таблице
			showShips(player_field, player_array);

			player_td = player_field.find('td');
			computer_td = computer_field.find('td');

			generateVariants();

			//Включаем режим игры
			$('body').removeClass('play-game show-main-menu game-win game-losing');
			$('body').addClass('play-game');

			unblockPlayer();

			//Убираем индикатор загрузки
			loading_indicator.delay(100).fadeOut(100);
			return false;
		}


		/* Функция генерации таблицы. На вход поступает объект <table></table> */
		function generateTable(table, array){
			move_count = 0;
			var tr_html = '',
				alphabet = ['A', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К', 'Л', 'М','Н','О','П','Р','С','Т','У','Ф','Ц','Ч','Ш','Щ','Э','Ю','Я'];
			array = [];
			//Очищаем таблицу
			table.html('');
			//Перебор по строкам
			for (var i = 0; i < field_size; i++){
				tr_html = '<tr>';
				array.push([]);
				//Перебор по столбцам
				for (var j = 0; j < field_size; j++){
					//Открываем тэг td и добавляем пробел
					tr_html += '<td> &nbsp;';
					//Если первая строка, то добавляем маркер строки
					if(j == 0)
						tr_html += '<div class="marker-row">' + (i + 1) + '</div>';
					//Если первый столбец, то добавляем маркер столбца
					if(i == 0)
						tr_html += '<div class="marker-col">' + (alphabet[j]) + '</div>';
					//Закрываем тэг td
					tr_html += '</td>';
					array[i].push(0);
				}
				tr_html += '</tr>';
				//Добавляем в таблицу сгенерированную строку
				table.append(tr_html);
			}
			generateShips(array);
			return array;
		}


		/* Генерация всех возможных вариантов для выстрела компьютером */
		function generateVariants(){
			computer_variants = [];
			computer_variants_coords = [];
			for (var i = 0; i < field_size; i++) {
				var row = []; 
				for (var j = 0; j < field_size; j++) {
					row.push(0);
					computer_variants_coords.push([i, j]);
				}
				computer_variants.push(row);
			}
		}


		/* Функция генерации кораблей */
		function generateShips(array){
			var ship_count = 1, //Сколько кораблей нужно разместить данного размера (например 1 => 4-х палубный, 2 => 3-х палубный и т.д.)
				ship_size;

			//Определяем количество видов кораблей + 1
			var max_ships_n = Math.floor(field_size / 2); // = 5 (Для поля 10 на 10)
			max_points = 0;
			//Перебор размеров кораблей
			while(ship_count < max_ships_n){
				ship_size = max_ships_n - ship_count; //размер корабля
				
				//Перебор количества кораблей определенного размера
				for (var i = 0; i < ship_count; i++) {
					var ship = {
						size: ship_size,
						id: ship_size + '' + i,
						direction: rand(0, 1)  //ориентация. 0 - по горизонтали, 1 - по вертикали 
					};
					addShip(array, ship);
					max_points += ship_size;
				}

				ship_count++;
			}
		}


		/* Функция добавления нового корабля */ 
		function addShip(array, ship){			
			var variants = [];
			var dir = ship.direction;

			//перебор по столбцам
			for (var i = 0; i < field_size; i++) {
				//перебор по строкам
				for (var j = 0; j < field_size; j++) {
					//Если ячейка свободна, то смотрим поместится ли корабль начиная с этой ячейки
					if(array[i][j] == 0)
					{	
						var flag_it_fit = true;
						for (var k = 0; k < ship.size; k++) {

							var new_i = (dir == 1) ? i + k : i,
								new_j = (dir == 0) ? j + k : j;

							//Если ячейка не пустая или выходит за пределы поля, то значит туда нельзя расположить корабль
							if(new_i > field_size - 1 || new_j > field_size - 1 || array[new_i][new_j] > 0){
								flag_it_fit = false;
								break;
							}

							//Если здесь мы можем расположить корабль, то проверяем ячейки по периметру
							if(flag_it_fit == true)
								flag_it_fit = !checkPerimeter(array, new_i, new_j, dir, ship.size);
						}
						if(flag_it_fit == true){
							variants.push([i, j]);
						}
					}
				}
			}

			//Конечный вариант расположения. Выбиается рандомно...
			var random_num = rand(0, variants.length - 1);
			var location = variants[random_num];

			if(variants.length == 0){
				if(move_count == 0){
					ship.direction = (ship.direction == 0) ? 1 : 0;
					addShip(array, ship);
					move_count++;
					return false;
				}
				if(move_count == 1){
					return false;
				}
			}
			else{

				for (var k = 0; k < ship.size; k++) {
					var new_i = (dir == 1) ? location[0] + k : location[0],
						new_j = (dir == 0) ? location[1] + k : location[1];
					array[new_i][new_j] = ship.id + ship.direction;
				}

				//Получаем индексы ячеек по периметру
				var perimeter = getPerimeterIndexes(array, location[0], location[1], dir, ship.size);

				//Перебираем все ячейки по периметру
				for (var k = 0; k < perimeter.length; k++) {
					//Задаём значение ячейки равной -1
					setCellValue(array, perimeter[k][0], perimeter[k][1], -1);
				}
			}
		}


		/* Функция проверерки наличия кораблей по периметру */
		function checkPerimeter(array, i, j, dir, ship_size){
			//Получаем индексы ячеек по периметру
			var perimeter = getPerimeterIndexes(array, i, j, dir, ship_size),
				flag_exist_ship = false;

			//Перебираем все ячейки по периметру
			for (var i = 0; i < perimeter.length; i++) {
				//Проверка ячейки на наличие корабля
				flag_exist_ship = existShip(array, perimeter[i][0], perimeter[i][1]);
				if(flag_exist_ship == true)
					break;
			}
			return flag_exist_ship;
		}


		/* Получить индексы ячеек расположенных по периметру корабля */
		function getPerimeterIndexes(array, i, j, dir, ship_size){
			var indexes = [];
			for (k = 0; k < ship_size; k++) {				
				var new_i = (dir == 1) ? i + k : i,
					new_j = (dir == 0) ? j + k : j;

				//Если по вертикали
				if (dir == 1)
				{	
					indexes.push([new_i,   new_j-1]);
					indexes.push([new_i,   new_j+1]);

					if(k == 0){	
						indexes.push([new_i-1, new_j-1]);
						indexes.push([new_i-1, new_j]);
						indexes.push([new_i-1, new_j+1]);
					}

					if(k == ship_size-1){
						indexes.push([new_i+1, new_j-1]);
						indexes.push([new_i+1, new_j]);
						indexes.push([new_i+1, new_j+1]);
					}
				}
				
				//Если по горизонтали
				if (dir == 0)
				{	
					indexes.push([new_i-1,   new_j]);
					indexes.push([new_i+1,   new_j]);

					if(k == 0){	
						indexes.push([new_i-1, new_j-1]);
						indexes.push([new_i,   new_j-1]);
						indexes.push([new_i+1, new_j-1]);
					}

					if(k == ship_size-1){
						indexes.push([new_i-1, new_j+1]);
						indexes.push([new_i,   new_j+1]);
						indexes.push([new_i+1, new_j+1]);
					}
				}
			}
			return indexes;
		}


		/* Проверка наличия корабля в ячейке */
		function existShip(array, i, j){
			//Ячейка выходит за края поля, то 
			if(i < 0 || j < 0 || i >= field_size || j >= field_size)
				return false;
			
			//Если в этой ячейке есть корабль, то возвращаем true, иначе false
			if(array[i][j] > 0)
				return true;
			else
				return false;
		}


		/* Установка значения ячейки, если ячейка существует */
		function setCellValue(array, i, j, value){
			if(i > -1 && j > -1 && i < field_size && j < field_size && array[i][j] < 1){
				array[i][j] = value;
			}
		}


		/* Показать корабли */
		function showShips(table, array){
			var td = table.find('td');
			for (var i = 0; i < field_size; i++) {
				for (var j = 0; j < field_size; j++) {
					if(array[i][j] > 0)
						$(td[i * field_size + j]).addClass('ship');
				}
			}
		}


		/* Функция вывода ошибок при проверке введенных данных в input */
		function showInputError(input, input_info){
			//Делаем input крассного цвета
			input.addClass('error');
			//Показываем подсказку для корректного ввода
			input_info.addClass('show');
			//Фокусируемся на input, чтобы пользователь сразу мог начать исправлять ошибку ввода
			input.focus();

			//Очищаем предыдущий таймер
			clearTimeout(inputErrorTimeout);
			//Создаём новый таймер для восстановления исходного цвета input
			inputErrorTimeout = setTimeout(function(){
				input.removeClass('error');
			}, 800);
		}


		/* Функция выхода из игры, при этом происходит переход в главное меню */
		function exitGame(){
			score_game = [0, 0];
			resetScore();
			$('body').removeClass('play-game show-main-menu game-win game-losing');
			$('body').addClass('show-main-menu');
			loading_indicator.fadeIn(200);
		}


		/* Сброс счета игры */
		function resetScore(){
			score_game = [0, 0];
			$('#score-game').html('0 : 0');
		}


		/* Функция генерующая случайное число */
		function rand(min, max){
			if( max ) {
				return Math.floor(Math.random() * (max - min + 1)) + min;
			} else {
				return Math.floor(Math.random() * (min + 1));
			}
		}


		/* ------- ХОД ИГРЫ ------- */
		/*Событие нажатия на ячейку таблицы противника*/
		$(document).on('click','#computer-field td:not(.hit, .missed)',function() {
			if(flag_block_player == true)
				return false;
			var td = $(this);
			blockPlayer();
			fire(td, computer_td, computer_array, false);
		});


		/* Функция выстрела по определенной ячейке */
		function fire(td, array_td, array, computer_event){
			var coords = getCords(array_td, td);
			var row = coords[0];
			var cell = coords[1];
			
			if(computer_event){
				computer_variants[row][cell] = 1;
			}

			//Если есть попадание в цель
			if(array[row][cell] > 0)
				hit(td, array_td, array, row, cell, computer_event);
			//Если промах
			else{
				if(computer_event == false){
					stepComputer();
					missed(td);
				}
				else
					{	
						unblockPlayer();
						$(player_field.find('.last-missed')).removeClass('last-missed');
						missed(td);
						td.addClass('last-missed');
					}
			}
		}

		/* Функция отметки попадания в корабль */
		function hit(td, array_td, array, row, cell, computer_event){
			if(computer_event == false)
				unblockPlayer();

			//Добавим эффект взрыва
			if(propIsSupported('pointer-events'))
				if(td.find('.smoke').length == 0){
					//Генерируем случайны ID
					var audio_id = 'audio-' + Math.random().toString(36).slice(2, 2 + Math.max(1, Math.min(5, 10)));

					$('body').append('<audio autoplay class="audio-boom" id="' + audio_id + '"><source src="audio/boom.mp3" type="audio/mpeg"></audio>');
					var audio_boom = $('body').find('.audio-boom');
					td.append('<div class="smoke"></div>');
					td.addClass('ahead');

					setTimeout(function(){
						td.removeClass('ahead');
						td.find('.smoke').remove();
					},500);

					setTimeout(function(){
						$('#' + audio_id).remove();
					},2000);
				}

			td.addClass('hit');
			var value = array[row][cell];
			array[row][cell] = value * (-1); 
			var flag_kill = true;

			var dir = parseInt(value.charAt(2));
			var shipwreck = [];
			var ship_size = parseInt(value.charAt(0));

			//Если однопалубный корабль, то просто добавляем его к обломкам, иначе ищем остальные обломки
			if(ship_size == 1){
				shipwreck.push([row, cell]);
			}
			else
			for (var i = 0; i < field_size; i++) {
				//если ищем по вертикали
				if(dir == 0){
					if(array[row][i] == -value)
						shipwreck.push([row, i]);
				}

				if(dir == 1){
					if(array[i][cell] == -value)
						shipwreck.push([i, cell]);
				}
			}

			//Если корабль полностью уничтожен, т.е. количество обломков == размеру корабля, то отмечаем, что корабль потоплен
			if(shipwreck.length == ship_size)
			{	
				//Перебор ячеек корабля
				for (var i = 0; i < ship_size; i++) {
					var kill_td = array_td[shipwreck[i][0]*field_size + shipwreck[i][1]];
					$(kill_td).addClass('kill');
					
					if(computer_event == true){
						setCellValue(computer_variants, shipwreck[i][0], shipwreck[i][1], 1);
						removeVariant(computer_variants_coords, shipwreck[i][0], shipwreck[i][1]);
					}
				}

				//Получим индексы ячеек по периметру корабля
				var perimeter = getPerimeterIndexes(array, shipwreck[0][0], shipwreck[0][1], dir, ship_size);
			   	
			   	//Перебираем ячейки по периметру корабля
				for (var i = 0; i < perimeter.length; i++) {
					markTd(array_td, perimeter[i][0], perimeter[i][1], 'missed');

					if(computer_event == true){
						setCellValue(computer_variants, perimeter[i][0], perimeter[i][1], 1);
						removeVariant(computer_variants_coords, perimeter[i][0], perimeter[i][1]);
					}
				}

				//Если корабль уничтожил компьютер
				if(computer_event == true){
					computer_hit_variants = [];
					last_coords = [];
					computer_td_direction = -1;
					computer_points += ship_size;

					//Если все корабли сбиты, то завершаем игру
					if(computer_points == max_points){
						endGame();
						return false;
					}
					else
						stepComputer();
				}
				else{
					player_points += ship_size;
					//Если все корабли сбиты, то завершаем игру
					if(player_points == max_points){
						endGame();
						return false;
					}
				}
			}
			//Если корабль не уничтожен
			else{
				//Если выстрел сделал компьютер
				if(computer_event == true){
					if(last_coords.length == 2){
						last_coords.push([row, cell]);
						last_coords = MinMaxLastCoords(last_coords, computer_td_direction);
					}
					else
						last_coords.push([row, cell]);

					if(last_coords.length == 2){
						if(computer_td_direction == -1)
							computer_hit_variants = [];

						//Если строки совпадают, то значит корабль расположен по горизонтали
						if(last_coords[0][0] == last_coords[1][0]){
							computer_td_direction = 0;
						}
						else
							//Если столбцы совпадают, то значит корабль расположен по вертикали
							if(last_coords[0][1] == last_coords[1][1]){
								computer_td_direction = 1;
							}

					}

					//Если компьютер пока не знает как расположен корабль, горизонтально или вертикально
					if(computer_td_direction == -1){
						//Берем 4 ячейки для проверки. По ним компьютер будет стрелять
						if(checkCellForFire(computer_variants, row + 1, cell) == true)
							computer_hit_variants.push([row + 1, cell]);
						
						if(checkCellForFire(computer_variants, row - 1, cell) == true)
							computer_hit_variants.push([row - 1, cell]);

						if(checkCellForFire(computer_variants, row, cell + 1) == true)
							computer_hit_variants.push([row, cell + 1]);

						if(checkCellForFire(computer_variants, row, cell - 1) == true)
							computer_hit_variants.push([row, cell -1]);

						stepComputer();
					}
					else
					//Если компьютер знает что корабль расположен по горизонтали
					if(computer_td_direction == 0){

						var left_coord,
							right_coord;

						//Выбираем какая ячейка левее и какая правее по отношению друг к другу
						if(last_coords[0][1] < last_coords[1][1]){
							left_coord = last_coords[0];
							right_coord = last_coords[1];
						}
						else{
							left_coord = last_coords[1];
							right_coord = last_coords[0];
						}

						if(checkCellForFire(computer_variants, left_coord[0] , left_coord[1] - 1) == true)
							computer_hit_variants.push([left_coord[0] , left_coord[1] - 1]);

						if(checkCellForFire(computer_variants, right_coord[0], right_coord[1] + 1) == true)
							computer_hit_variants.push([right_coord[0] , right_coord[1] + 1]);

						stepComputer();
					}
					else
					//Если компьютер знает что корабль расположен по вертикали
					if(computer_td_direction == 1){

						var top_coord = 0,
							bottom_coord =0;

						//Выбираем какая ячейка выше и какая ниже по отношению друг к другу
						if(last_coords[0][0] < last_coords[1][0]){
							top_coord = last_coords[0];
							bottom_coord = last_coords[1];
						}
						else{
							top_coord = last_coords[1];
							bottom_coord = last_coords[0];
						}

						if(checkCellForFire(computer_variants, top_coord[0] - 1, top_coord[1]) == true)
							computer_hit_variants.push([top_coord[0] - 1, top_coord[1]]);

						if(checkCellForFire(computer_variants, bottom_coord[0] + 1, bottom_coord[1]) == true)
							computer_hit_variants.push([bottom_coord[0] + 1, bottom_coord[1]]);
						stepComputer();
					}
				}
			}
		}


		/* Поиск двух крайних ячеек */
		function MinMaxLastCoords(last_coords, dir){
			var min = last_coords[0], 
			    max = last_coords[0];

			//Если по вертикали, то сравниваем строки
			if(dir == 1){
				for (var i = 1; i < last_coords.length; i++) {
					if(last_coords[i][0] > max[0])
						max = last_coords[i];

					if(last_coords[i][0] < min[0])
						min = last_coords[i];
				}
			}
			else
			//Если по горизонтали, то сравниваем столбцы
			if(dir == 0){
				for (var i = 1; i < last_coords.length; i++) {
					if(last_coords[i][1] > max[1])
						max = last_coords[i];

					if(last_coords[i][1] < min[1])
						min = last_coords[i];
				}
			}
			return [min, max];
		}


		/* Проверка пригодности ячейки для выстрела */
		function checkCellForFire(array, i, j){
			if(i < 0 || j < 0 || i >= field_size || j >= field_size)
				return false;
			else{
				if(computer_variants[i][j] == 0)
					return true;
				else
					return false;
			}
		}


		/* Функция класса ячейке */
		function markTd(array_td, i, j, class_td){
			//Если ячейка существует и не выходит за границы, то добавляем класс
			if(i > -1 && j > -1 && i < field_size && j < field_size){
				$(array_td[ i * field_size + j]).addClass(class_td);
			}
		}


		/* Функция обозначения промаха */
		function missed(td){
			var audio_id = 'audio-' + Math.random().toString(36).slice(2, 2 + Math.max(1, Math.min(5, 10)));
			$('body').append('<audio autoplay class="audio-missed" id="' + audio_id + '"><source src="audio/missed.mp3" type="audio/mpeg"></audio>');
			setTimeout(function(){
				$('#' + audio_id).remove();
			},1000);
			td.addClass('missed');
		}


		/* Блокировка пользователя */
		function blockPlayer(){
			flag_block_player = true;
			$('#computer-field').addClass('block-player');
			$('#game-status').addClass('computer-step');
			$('#game-status').html('Сейчас ходит компьютер...');
		}


		/* Разблокировка пользователя */
		function unblockPlayer(){
			flag_block_player = false;
			$('#computer-field').removeClass('block-player');
			$('#game-status').removeClass('computer-step');
			$('#game-status').html('Сейчас ваш ход');
		}


		/* Выбор ячейки для атаки компьютером */
		function stepComputer(){
			setTimeout(function(){
				var td,
					random_num,
					coords,
					flag_exist = false;
				//Если нет вариантов для атаки
				if(computer_hit_variants.length == 0){
					random_num = rand(0, computer_variants_coords.length - 1);
					coords = computer_variants_coords[random_num];
					td = getTD(player_td, coords[0], coords[1]);
					removeVariant(computer_variants_coords, coords[0], coords[1]);
					setTimeout(function(){
						fire(td, player_td, player_array, true);
					}, 200);
				}
				else{
					random_num = rand(0, computer_hit_variants.length - 1);
					coords = computer_hit_variants[random_num];
					td = getTD(player_td, coords[0], coords[1]);
					removeVariant(computer_variants_coords, coords[0], coords[1]);
					removeVariant(computer_hit_variants, coords[0], coords[1]);
					fire(td, player_td, player_array, true);
				}
			}, 300);
		}


		/* Получить элемент td по заданным координатам */
		function getTD(array_td, row, cell){
			return $(array_td[row * field_size + cell]);
		}


		/* Получить координаты элемента td в массиве */
		function getCords(array_td, td){
			var index = array_td.index(td);
			var row = Math.floor(index/field_size);
			var cell = index - row * field_size;
			return [row, cell];
		}


		/* Удалить вариант по заданным координатам */
		function removeVariant(array, row, cell){
			for (var i = 0; i < array.length; i++) {
				if(array[i][0] == row && array[i][1] == cell){
					array.splice(i, 1);
					break;
				}
			}
		}


		/* Функция завершения игры */
		function endGame(){
			setTimeout(function(){
				if(computer_points < player_points){
					score_game[0]++;
					$('body').removeClass('play-game show-main-menu game-win game-losing');
					$('body').addClass('game-win');
				}
				else{
					score_game[1]++;
					$('body').removeClass('play-game show-main-menu game-win game-losing');
					$('body').addClass('game-losing');
				}

				$('#score-game').html(score_game[0] + ' : ' + score_game[1]);
			}, 1000);
		}

	});

	
})(jQuery)